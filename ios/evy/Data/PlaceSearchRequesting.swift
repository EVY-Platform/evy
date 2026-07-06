//
//  PlaceSearchRequesting.swift
//  evy
//

import Foundation

protocol PlaceSearchRequesting: Sendable {
  func search(method: String, input: String) async throws -> EVYJson
}

struct APISearchRequester: PlaceSearchRequesting {
  func search(method: String, input: String) async throws -> EVYJson {
    let payload = APISearchPayload.fromCurrentLocale(input: input)
    return try await EVYAPIManager.shared.fetch(
      method: "api",
      params: CoreAPIParams(
        service: EVY_CORE_SERVICE,
        method: method,
        data: payload
      ),
      expecting: EVYJson.self
    )
  }
}
