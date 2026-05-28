//
//  EVYWebsocket.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation
import JsonRPC
import Serializable

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

final class EVYWebsocket: EVYWebsocketProtocol {
  let rpc: Client & Persistent & Connectable
  private let wsURL: URL
  private var binarySocket: EVYAuthenticatedBinarySocket?
  private var loginToken: String?
  private var loginOS: DataOS?

  init(host: String) {
    wsURL = URL(string: "ws://\(host)")!
    rpc = JsonRpc(.ws(url: wsURL, autoconnect: false), queue: .main)
    rpc.delegate = self
  }

  func connect(token: String, os: DataOS) async throws -> Bool {
    loginToken = token
    loginOS = os
    if rpc.connected == .disconnected {
      rpc.connect()
    }
    return try await fetch(
      method: "rpc.login",
      params: EVYLoginParams(token: token, os: os),
      expecting: Bool.self)
  }

  func sendBinary(_ data: Data) async throws {
    if binarySocket == nil {
      guard let token = loginToken, let os = loginOS else {
        throw EVYRPCError.connectionError("Not authenticated")
      }
      let socket = EVYAuthenticatedBinarySocket(url: wsURL)
      try await socket.authenticateAndConnect(token: token, os: os)
      binarySocket = socket
    }
    try await binarySocket!.send(data)
  }

  func subscribe(event: String) async throws -> [String: String] {
    try await fetch(
      method: "rpc.on",
      params: [event],
      expecting: [String: String].self
    )
  }

  func fetch<T: Codable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T {
    do {
      return try await rpc.call(method: method, params: params, T.self, String.self)
    } catch let error as AsAnyRequestError {
      #if DEBUG
        print("[EVYWebsocket] RPC error for method '\(method)': \(error)")
      #endif
      throw mapRequestError(error.anyRequestError)
    } catch {
      #if DEBUG
        print("[EVYWebsocket] Unknown error for method '\(method)': \(error)")
      #endif
      throw EVYRPCError.unknownError(error.localizedDescription)
    }
  }

  private func mapRequestError(_ error: RequestError<Any, Any>) -> EVYRPCError {
    switch error {
    case .reply(_, _, let responseError):
      return .rpcError(code: responseError.code, message: responseError.message)
    case .service(.connection(let cause)):
      return .connectionError(cause.localizedDescription)
    case .service(.codec(let cause)):
      return .unknownError("Encoding/decoding error: \(cause.localizedDescription)")
    case .service(.envelope(_, let description)):
      return .unknownError("Protocol error: \(description)")
    case .service(.unregisteredResponse(let id, _)):
      return .unknownError("Unregistered response with id: \(id)")
    case .empty:
      return .unknownError("Empty response from server")
    case .custom(let description, _):
      return .unknownError(description)
    }
  }
}

extension EVYWebsocket: ConnectableDelegate, NotificationDelegate, ErrorDelegate {

  private func postError(_ error: Error) {
    #if DEBUG
      print("[EVYWebsocket] Error: \(error.localizedDescription)")
    #endif
    NotificationCenter.default.post(
      name: Notification.Name.evyErrorOccurred,
      object: error
    )
  }

  #if DEBUG
    func state(_ state: ConnectableState) {
      print("[EVYWebsocket] Connection state changed: \(state)")
    }
  #endif

  func error(_ error: ServiceError) {
    #if DEBUG
      print("[EVYWebsocket] Service error: \(error)")
    #endif
    postError(EVYError.websocketError(context: error.localizedDescription))
  }

  func notification(method: String, params: Parsable) {
    switch method {
    case "dataChanged":
      handleDataChanged(params: params)
    default:
      #if DEBUG
        print("[EVYWebsocket] Received unknown notification: \(method)")
      #endif
    }
  }

  private func handleDataChanged(params: Parsable) {
    let notification: DataChangedNotification

    do {
      guard let parsed = try params.parse(to: DataChangedNotification.self).get() else {
        throw EVYError.parsingFailed(context: "dataChanged notification returned nil")
      }
      notification = parsed
    } catch {
      postError(EVYError.parsingFailed(context: "dataChanged: \(error.localizedDescription)"))
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
          EVYError.invalidData(context: "failed to update data: \(error.localizedDescription)"))
      }
    }
  }

}

// MARK: - Binary WebSocket

/// A minimal WebSocket that authenticates via JSON-RPC rpc.login then sends binary frames.
final class EVYAuthenticatedBinarySocket {
  private let task: URLSessionWebSocketTask

  init(url: URL) {
    task = URLSession.shared.webSocketTask(with: url)
    task.resume()
  }

  func authenticateAndConnect(token: String, os: DataOS) async throws {
    let loginParams = EVYLoginParams(token: token, os: os)
    let paramsData = try JSONEncoder().encode(loginParams)
    let paramsJSON = String(data: paramsData, encoding: .utf8)!
    let rpcMessage =
      "{\"jsonrpc\":\"2.0\",\"method\":\"rpc.login\",\"params\":\(paramsJSON),\"id\":1}"
    try await task.send(.string(rpcMessage))

    let response = try await task.receive()
    let responseString: String
    switch response {
    case .string(let s): responseString = s
    case .data(let d): responseString = String(data: d, encoding: .utf8) ?? ""
    @unknown default: throw EVYRPCError.loginError
    }
    guard responseString.contains("\"result\":true") || responseString.contains("\"result\":1")
    else {
      throw EVYRPCError.loginError
    }
  }

  func send(_ data: Data) async throws {
    try await task.send(.data(data))
  }

  deinit {
    task.cancel(with: .goingAway, reason: nil)
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
