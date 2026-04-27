//
//  EVYWebsocket.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation
import JsonRPC
import Serializable

public enum EVYRPCError: LocalizedError {
  case loginError
  case connectionError(String)
  case rpcError(code: Int, message: String)
  case unknownError(String)
  case subscriptionError(String)

  public var errorDescription: String? {
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

struct DataUpdatedNotification: Decodable {
  let dataId: String
  let data: EVYJson
  let createdAt: String
  let updatedAt: String

  enum CodingKeys: String, CodingKey {
    case dataId = "id"
    case data
    case createdAt
    case updatedAt
  }
}

struct FlowUpdatedNotification: Decodable {
  let flow: UI_Flow

  enum CodingKeys: String, CodingKey {
    case flow = "data"
  }
}

protocol EVYWebsocketProtocol {
  func connect(token: String, os: DataOS) async throws -> Bool
  func fetch<T: Codable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T
  func subscribe(event: String) async throws -> [String: String]
}

final class EVYWebsocket: EVYWebsocketProtocol {
  let rpc: Client & Persistent & Connectable

  init(host: String) {
    rpc = JsonRpc(.ws(url: URL(string: "ws://\(host)")!, autoconnect: false), queue: .main)
    rpc.delegate = self
  }

  public func connect(token: String, os: DataOS) async throws -> Bool {
    if rpc.connected == .disconnected {
      rpc.connect()
    }
    return try await fetch(
      method: "rpc.login",
      params: EVYLoginParams(token: token, os: os),
      expecting: Bool.self)
  }

  public func subscribe(event: String) async throws -> [String: String] {
    try await fetch(
      method: "rpc.on",
      params: [event],
      expecting: [String: String].self
    )
  }

  public func fetch<T: Codable>(
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
    public func state(_ state: ConnectableState) {
      print("[EVYWebsocket] Connection state changed: \(state)")
    }
  #endif

  public func error(_ error: ServiceError) {
    #if DEBUG
      print("[EVYWebsocket] Service error: \(error)")
    #endif
    postError(EVYError.websocketError(context: error.localizedDescription))
  }

  public func notification(method: String, params: Parsable) {
    switch method {
    case "dataUpdated":
      handleDataUpdated(params: params)
    case "flowUpdated":
      handleFlowUpdated(params: params)
    default:
      #if DEBUG
        print("[EVYWebsocket] Received unknown notification: \(method)")
      #endif
    }
  }

  private func handleDataUpdated(params: Parsable) {
    let notification: DataUpdatedNotification
    let encodedData: Data

    do {
      guard let parsed = try params.parse(to: DataUpdatedNotification.self).get() else {
        throw EVYError.parsingFailed(context: "dataUpdated notification returned nil")
      }
      notification = parsed
      encodedData = try JSONEncoder().encode(notification.data)
    } catch {
      #if DEBUG
        print("[EVYWebsocket] Failed to parse dataUpdated notification: \(error)")
      #endif
      postError(EVYError.parsingFailed(context: "dataUpdated: \(error.localizedDescription)"))
      return
    }

    // Dispatch to MainActor for thread-safe data access
    Task { @MainActor in
      do {
        if EVY.data.exists(key: notification.dataId) {
          try EVY.data.update(props: [notification.dataId], data: encodedData)
        } else {
          try EVY.data.create(key: notification.dataId, data: encodedData)
        }
        NotificationCenter.default.post(
          name: Notification.Name.evyDataUpdated,
          object: notification.dataId
        )
      } catch {
        #if DEBUG
          print("[EVYWebsocket] Failed to update data: \(error)")
        #endif
        self.postError(
          EVYError.invalidData(context: "failed to update data: \(error.localizedDescription)"))
      }
    }
  }

  private func handleFlowUpdated(params: Parsable) {
    do {
      guard let notification = try params.parse(to: FlowUpdatedNotification.self).get() else {
        throw EVYError.parsingFailed(context: "flowUpdated notification returned nil")
      }

      Task { @MainActor in
        NotificationCenter.default.post(
          name: Notification.Name.evyFlowUpdated,
          object: notification.flow
        )
      }
    } catch {
      #if DEBUG
        print("[EVYWebsocket] Failed to parse flowUpdated notification: \(error)")
      #endif
      postError(EVYError.parsingFailed(context: "flowUpdated: \(error.localizedDescription)"))
    }
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
