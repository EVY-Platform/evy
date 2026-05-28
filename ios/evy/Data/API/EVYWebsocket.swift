//
//  EVYWebsocket.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

enum EVYRPCError: LocalizedError {
  case loginError
  case connectionError(String)
  case rpcError(code: Int, message: String)
  case unknownError(String)
  case subscriptionError(String)

  var errorDescription: String? {
    switch self {
    case .loginError:
      return "Authentication failed"
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

protocol EVYWebsocketProtocol {
  func connect(token: String, os: DataOS) async throws -> Bool
  func sendBinary(_ data: Data) async throws
  func fetch<T: Codable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T
  func subscribe(event: String) async throws -> [String: String]
}

@MainActor
final class EVYWebsocket: EVYWebsocketProtocol {
  private var task: URLSessionWebSocketTask?
  private var pendingRequests: [Int: CheckedContinuation<String, Error>] = [:]
  private var nextId = 1
  private let wsURL: URL

  nonisolated init(host: String) {
    wsURL = URL(string: "ws://\(host)")!
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

  func fetch<T: Codable>(
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
      Task { @MainActor [weak self] in
        guard let self else { return }
        do {
          try await task.send(.string(rpcMessage))
        } catch {
          if let c = self.pendingRequests.removeValue(forKey: id) {
            c.resume(throwing: error)
          }
        }
      }
    }

    return try parseResult(T.self, from: rawResponse)
  }

  private func openSocket() {
    let delegate = EVYWebSocketDelegate { [weak self] in
      Task { @MainActor [weak self] in self?.handleDisconnect() }
    }
    let urlSession = URLSession(
      configuration: .default, delegate: delegate, delegateQueue: .main)
    let wsTask = urlSession.webSocketTask(with: wsURL)
    task = wsTask
    wsTask.resume()
    startReceiveLoop(for: wsTask)
  }

  private func startReceiveLoop(for wsTask: URLSessionWebSocketTask) {
    Task { @MainActor [weak self] in
      while true {
        do {
          let message = try await wsTask.receive()
          self?.dispatch(message)
        } catch {
          self?.handleDisconnect()
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

  private func handleDisconnect() {
    task = nil
    let pending = pendingRequests
    pendingRequests.removeAll()
    for continuation in pending.values {
      continuation.resume(
        throwing: EVYRPCError.connectionError("WebSocket disconnected"))
    }
    postError(EVYError.websocketError(context: "WebSocket disconnected"))
  }

  private func handleNotification(method: String, params: Any?) {
    switch method {
    case "dataChanged":
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
        try EVY.publicStore.applySyncedValue(
          namespace: notification.service,
          resource: notification.resource,
          value: notification.value
        )
      } catch {
        self.postError(
          EVYError.invalidData(
            context: "failed to update data: \(error.localizedDescription)"))
      }
    }
  }

  private func postError(_ error: Error) {
    #if DEBUG
      print("[EVYWebsocket] Error: \(error.localizedDescription)")
    #endif
    NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
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
      let message = errorObj["message"] as? String ?? "Unknown error"
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
  private let onClose: @Sendable () -> Void

  init(onClose: @escaping @Sendable () -> Void) {
    self.onClose = onClose
  }

  func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
    reason: Data?
  ) {
    onClose()
  }
}

enum JSONParseError: Error {
  case fileNotFound
  case dataInitialisation(error: Error)
  case decoding(error: Error)
}

extension Decodable {
  static func from(
    localJSON filename: String,
    bundle: Bundle = .main
  ) throws -> Self {
    guard let url = bundle.url(forResource: filename, withExtension: "json") else {
      throw JSONParseError.fileNotFound
    }
    let data: Data
    do {
      data = try Data(contentsOf: url)
    } catch let error {
      throw JSONParseError.dataInitialisation(error: error)
    }

    if self == Data.self {
      return data as! Self
    }

    do {
      return try JSONDecoder().decode(self, from: data)
    } catch let error {
      throw JSONParseError.decoding(error: error)
    }
  }
}
