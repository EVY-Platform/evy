//
//  EVYAPIManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

private func requireAPIHost() -> String {
  guard let host = ProcessInfo.processInfo.environment["API_HOST"], !host.isEmpty else {
    fatalError("API_HOST is required (set by run-e2e.sh or Xcode scheme for iOS e2e)")
  }
  return host
}

let API_HOST = requireAPIHost()
let userDefault = UserDefaults.standard

final class EVYAPIManager {
  private let rpcWS: EVYWebsocketProtocol
  private var authed: Bool = false

  static let shared = EVYAPIManager()

  public func fetch<T: Codable>(
    method: String,
    params: Encodable,
    expecting _: T.Type
  ) async throws -> T {
    try await validateAuth()
    return try await rpcWS.fetch(method: method, params: params, expecting: T.self)
  }

  private init() {
    self.rpcWS = EVYWebsocket(host: API_HOST)
  }

  private func validateAuth() async throws {
    if authed { return }

    authed = try await rpcWS.connect(token: "Geo", os: DataOS.ios)

    let result = try await rpcWS.subscribe(event: "flowUpdated")
    if result["flowUpdated"] != "ok" {
      throw EVYRPCError.subscriptionError("Failed to subscribe to flowUpdated events")
    }
  }
}
