//
//  EVYAPIManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

let API_HOST = "localhost:8000"

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
    let host = ProcessInfo.processInfo.environment["API_HOST"] ?? API_HOST
    self.rpcWS = EVYWebsocket(host: host)
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
