//
//  EVY+Sync.swift
//  evy
//

import Foundation

extension EVY {
  static func getUserData() throws {
    let userData = try EVYJson.from(localJSON: "user_data")
    let encodedUserData = try JSONEncoder().encode(userData)
    do {
      try EVY.publicStore.create(key: "user", data: encodedUserData)
    } catch EVYDataError.keyAlreadyExists {
      // Expected when startup bootstrapping runs after user data already exists.
    }
  }

  /// Unified sync — returns the synced SDUI flows for immediate display.
  static func sync() async throws -> [UI_Flow] {
    let lastSyncTime =
      publicStore.oldestLastSyncedAt()
      ?? "1970-01-01T00:00:00.000Z"

    let response: SyncResponse = try await EVYAPIManager.shared.fetch(
      method: "sync",
      params: SyncParams(lastSyncTime: lastSyncTime),
      expecting: SyncResponse.self
    )

    if let resources = response.resources {
      applyResourceMapping(resources.resources, resourcesByService: resources.resourcesByService)

      if let encoded = try? JSONEncoder().encode(resources.resources) {
        UserDefaults.standard.set(encoded, forKey: "cachedResourceMapping")
      }
    }

    var syncedFlows: [UI_Flow] = []

    for row in response.data {
      let key = "\(row.service):\(row.resource)"
      let encoded = try JSONEncoder().encode(row.value)
      try publicStore.upsert(key: key, value: encoded)

      if row.service == "evy" && row.resource == "sdui" {
        if let flows = try? JSONDecoder().decode([UI_Flow].self, from: encoded) {
          syncedFlows = flows
        }
      }
    }

    if syncedFlows.isEmpty, let cachedFlowData = try? publicStore.get(key: "evy:sdui").data,
      let cachedFlows = try? JSONDecoder().decode([UI_Flow].self, from: cachedFlowData)
    {
      syncedFlows = cachedFlows
    }

    return syncedFlows
  }
}
