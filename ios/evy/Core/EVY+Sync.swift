//
//  EVY+Sync.swift
//  evy
//

import Foundation

extension EVY {
  // MARK: - Sync Timestamp

  private static let lastSyncTimestampKey = "lastSyncTimestamp"

  static func getUserData() throws {
    let userData = try EVYJson.from(localJSON: "user_data")
    let encodedUserData = try JSONEncoder().encode(userData)
    // Upsert user data under local namespace
    try EVY.publicStore.upsert(
      namespace: EVYNamespace.local, resource: "user", id: EVYNamespace.singletonId,
      value: encodedUserData)
  }

  /// Last successful sync checkpoint, stored in UserDefaults.
  /// Falls back to epoch start if never synced.
  static var lastSyncTimestamp: String {
    UserDefaults.standard.string(forKey: lastSyncTimestampKey)
      ?? "1970-01-01T00:00:00.000Z"
  }

  /// Persist the sync checkpoint after a successful sync.
  private static func setLastSyncTimestamp(_ timestamp: String) {
    UserDefaults.standard.set(timestamp, forKey: lastSyncTimestampKey)
  }

  /// Unified sync — returns the synced SDUI flows for immediate display.
  static func sync() async throws -> [UI_Flow] {
    let lastSyncTime = lastSyncTimestamp

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

    // Normalize each sync row into individual instances
    for row in response.data {
      try publicStore.upsertSyncedValue(
        namespace: row.service, resource: row.resource, value: row.value)
    }

    // Persist the sync checkpoint after all rows applied successfully
    setLastSyncTimestamp(Date().ISO8601Format())

    // Reconstruct SDUI flows from normalized evy/sdui instances
    return try reconstructedSduiFlows()
  }

  /// Reconstruct SDUI flow array from normalized evy/sdui instances.
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
