//
//  EVYWebsocket.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

enum EVYRPCError: LocalizedError {
  case connectionError(String)
  case rpcError(code: Int, message: String)
  case unknownError(String)
  case subscriptionError(String)

  var errorDescription: String? {
    switch self {
    case .connectionError(let message):
      return "Connection error: \(message)"
    case .rpcError(_, let message):
      return message
    case .unknownError(let message):
      return message
    case .subscriptionError(let message):
      return "Subscription error: \(message)"
    }
  }
}

struct EVYLoginParams: Encodable {
  let token: String
  let os: DataOS
}

struct DataChangedNotification: Decodable {
  let service: String
  let resource: String
  let operation: String
  let value: EVYJson
}

/// Connection-owning transport used by `EVYAPIManager`. Exists so the manager's
/// session lifecycle (auth state, reconnect) can be tested without a live socket.
protocol EVYRPCTransport: Actor {
  var isConnected: Bool { get }
  func setDisconnectHandler(_ handler: (@Sendable () async -> Void)?)
  func connect(token: String, os: DataOS) async throws -> Bool
  func subscribe(event: String) async throws -> [String: String]
  func fetch<T: Codable & Sendable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T
  func sendBinary(_ data: Data) async throws
}

actor EVYWebsocket: EVYRPCTransport {
  private var task: URLSessionWebSocketTask?
  private var pendingRequests: [Int: CheckedContinuation<String, Error>] = [:]
  private var nextId = 1
  private var urlSession: URLSession?
  private let wsURL: URL
  private var onDisconnect: (@Sendable () async -> Void)?

  init(host: String) {
    wsURL = URL(string: "ws://\(host)")!
  }

  var isConnected: Bool { task != nil }

  func setDisconnectHandler(_ handler: (@Sendable () async -> Void)?) {
    onDisconnect = handler
  }

  func connect(token: String, os: DataOS) async throws -> Bool {
    if task == nil {
      openSocket()
    }
    return try await fetch(
      method: "rpc.login",
      params: EVYLoginParams(token: token, os: os),
      expecting: Bool.self
    )
  }

  func sendBinary(_ data: Data) async throws {
    guard let task else {
      throw EVYRPCError.connectionError("Not connected")
    }
    try await task.send(.data(data))
  }

  func subscribe(event: String) async throws -> [String: String] {
    try await fetch(method: "rpc.on", params: [event], expecting: [String: String].self)
  }

  func fetch<T: Codable & Sendable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T {
    let id = nextId
    nextId += 1
    let rpcMessage = try buildRPCMessage(method: method, params: params, id: id)

    guard let task else {
      throw EVYRPCError.connectionError("Not connected")
    }

    let rawResponse: String = try await withCheckedThrowingContinuation { continuation in
      pendingRequests[id] = continuation
      Task { [weak self] in
        guard let self else { return }
        do {
          try await task.send(.string(rpcMessage))
        } catch {
          if let c = await self.removePendingRequest(forKey: id) {
            c.resume(throwing: error)
          }
        }
      }
    }

    return try parseResult(T.self, from: rawResponse)
  }

  private func removePendingRequest(forKey id: Int) -> CheckedContinuation<String, Error>? {
    pendingRequests.removeValue(forKey: id)
  }

  private func openSocket() {
    let delegate = EVYWebSocketDelegate { [weak self] closedTask in
      Task { [weak self] in await self?.handleDisconnect(for: closedTask) }
    }
    let session = URLSession(
      configuration: .default, delegate: delegate, delegateQueue: nil)
    urlSession = session
    let wsTask = session.webSocketTask(with: wsURL)
    wsTask.maximumMessageSize = 20 * 1024 * 1024
    task = wsTask
    wsTask.resume()
    startReceiveLoop(for: wsTask)
  }

  private func startReceiveLoop(for wsTask: URLSessionWebSocketTask) {
    Task { [weak self] in
      while true {
        do {
          let message = try await wsTask.receive()
          await self?.dispatch(message)
        } catch {
          await self?.handleDisconnect(for: wsTask)
          break
        }
      }
    }
  }

  private func dispatch(_ message: URLSessionWebSocketTask.Message) {
    let text: String
    switch message {
    case .string(let s): text = s
    case .data(let d): text = String(data: d, encoding: .utf8) ?? ""
    @unknown default: return
    }

    guard let data = text.data(using: .utf8),
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return }

    if let id = json["id"] as? Int,
      let continuation = pendingRequests.removeValue(forKey: id)
    {
      continuation.resume(returning: text)
    } else if let method = json["method"] as? String {
      handleNotification(method: method, params: json["params"])
    }
  }

  /// Tears down a dropped socket exactly once. `closedTask` identifies the socket
  /// the callback came from, so a late callback from an already-replaced socket
  /// cannot tear down its successor.
  private func handleDisconnect(for closedTask: URLSessionWebSocketTask?) {
    guard let currentTask = task else { return }
    if let closedTask, closedTask !== currentTask { return }

    task = nil
    urlSession?.invalidateAndCancel()
    urlSession = nil

    let pending = pendingRequests
    pendingRequests.removeAll()
    for continuation in pending.values {
      continuation.resume(
        throwing: EVYRPCError.connectionError("WebSocket disconnected"))
    }

    // Surfacing the drop is the manager's job: it knows whether a reconnect is
    // already in flight and so whether the user needs to hear about it again.
    let handler = onDisconnect
    Task { await handler?() }
  }

  private func handleNotification(method: String, params: Any?) {
    switch method {
    case "data_changed":
      handleDataChanged(params: params)
    default:
      #if DEBUG
        print("[EVYWebsocket] Received unknown notification: \(method)")
      #endif
    }
  }

  private func handleDataChanged(params: Any?) {
    guard let params,
      let paramsData = try? JSONSerialization.data(withJSONObject: params),
      let notification = try? JSONDecoder().decode(
        DataChangedNotification.self, from: paramsData)
    else {
      postError(
        EVYError.parsingFailed(context: "dataChanged notification parsing failed"))
      return
    }

    Task { @MainActor in
      do {
        switch notification.operation {
        case "create", "update":
          try EVY.applySyncedValue(
            namespace: notification.service,
            resource: notification.resource,
            value: notification.value
          )
        case "delete":
          try EVY.removeSyncedValue(
            namespace: notification.service,
            resource: notification.resource,
            value: notification.value
          )
        default:
          #if DEBUG
            print("[EVYWebsocket] Ignoring unknown operation: \(notification.operation)")
          #endif
        }
      } catch {
        self.postError(
          EVYError.invalidData(
            context: "failed to update data: \(error.localizedDescription)"))
      }
    }
  }

  nonisolated private func postError(_ error: Error) {
    Task { @MainActor in
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
    }
  }

  private func buildRPCMessage(
    method: String, params: Encodable, id: Int
  ) throws -> String {
    let paramsData = try JSONEncoder().encode(params)
    let paramsJSON = String(data: paramsData, encoding: .utf8)!
    return
      "{\"jsonrpc\":\"2.0\",\"method\":\"\(method)\",\"params\":\(paramsJSON),\"id\":\(id)}"
  }

  private func parseResult<T: Decodable>(_ type: T.Type, from rawResponse: String) throws
    -> T
  {
    guard let responseData = rawResponse.data(using: .utf8) else {
      throw EVYRPCError.unknownError("Invalid response encoding")
    }
    guard let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any]
    else {
      throw EVYRPCError.unknownError("Invalid JSON response")
    }
    if let errorObj = json["error"] as? [String: Any] {
      let code = errorObj["code"] as? Int ?? -1
      // rpc-websockets puts a thrown error's class name in `message` ("Error") and the
      // actual reason in `data`, so reporting `message` alone tells the user nothing.
      let message =
        errorObj["data"] as? String ?? errorObj["message"] as? String ?? "Unknown error"
      throw EVYRPCError.rpcError(code: code, message: message)
    }
    guard let resultValue = json["result"] else {
      throw EVYRPCError.unknownError("Missing result in response")
    }
    if T.self == Bool.self, let boolValue = resultValue as? Bool {
      return boolValue as! T
    }
    let resultData = try JSONSerialization.data(withJSONObject: resultValue)
    return try JSONDecoder().decode(T.self, from: resultData)
  }
}

private final class EVYWebSocketDelegate: NSObject, URLSessionWebSocketDelegate {
  private let onClose: @Sendable (URLSessionWebSocketTask) -> Void

  init(onClose: @escaping @Sendable (URLSessionWebSocketTask) -> Void) {
    self.onClose = onClose
  }

  func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
    reason: Data?
  ) {
    onClose(webSocketTask)
  }
}
