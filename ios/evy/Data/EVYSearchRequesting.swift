//
//  EVYSearchRequesting.swift
//  evy
//

import Foundation

protocol EVYSearchRequesting: Sendable {
  func search(input: String) async throws -> EVYJson
}

struct EVYSearchRequest: Encodable {
  let input: String
}

struct EVYAPISearchRequester: EVYSearchRequesting {
  let method: String

  func search(input: String) async throws -> EVYJson {
    return try await EVYAPIManager.shared.fetch(
      method: "api",
      params: CoreAPIParams(
        service: EVY_CORE_SERVICE,
        method: method,
        data: EVYSearchRequest(input: input)
      ),
      expecting: EVYJson.self
    )
  }
}
