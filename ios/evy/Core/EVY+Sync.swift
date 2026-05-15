//
//  EVY+Sync.swift
//  evy
//

import Foundation

extension EVY {
  static func getUserData() throws {
    let userData = try EVYJson.from(localJSON: "user_data")
    let encodedUserData = try JSONEncoder().encode(userData)
    try EVY.publicStore.upsert(
      namespace: EVYNamespace.local, resource: "user", id: EVYNamespace.singletonId,
      value: encodedUserData)
  }

  /// Unified sync — returns the synced SDUI flows for immediate display.
  static func sync() async throws -> [UI_Flow] {
    let response: SyncResponse = try await EVYAPIManager.shared.fetch(
      method: "sync",
      params: SyncParams(lastSyncTime: EVYSyncState.lastSyncTimestamp),
      expecting: SyncResponse.self
    )

    if let resources = response.resources {
      applyResourceMapping(resources.resources, resourcesByService: resources.resourcesByService)

      if let encoded = try? JSONEncoder().encode(resources.resources) {
        UserDefaults.standard.set(encoded, forKey: "cachedResourceMapping")
      }
    }

    for row in response.data {
      try publicStore.upsertSyncedValue(
        namespace: row.service, resource: row.resource, value: row.value)
    }

    EVYSyncState.markSynced()
    return try reconstructedSduiFlows()
  }

  static func reconstructedSduiFlows() throws -> [UI_Flow] {
    guard
      let collectionJson = try publicStore.getCollectionJson(
        namespace: EVYNamespace.evy, resource: "sdui"),
      case .array(let flowValues) = collectionJson
    else {
      return []
    }

    let flows: [UI_Flow] = flowValues.compactMap { value in
      guard let data = try? JSONEncoder().encode(value),
        let flow = try? JSONDecoder().decode(UI_Flow.self, from: data)
      else { return nil }
      return flow
    }
    return flows
  }
}
