//
//  EVY+Sync.swift
//  evy
//

import Foundation

extension EVY {
  static func getUserData() throws -> EVYJson {
    try EVYJson.from(localJSON: "user_data")
  }

  static func sync() async throws {
    let response: SyncResponse = try await EVYAPIManager.shared.fetch(
      method: "sync",
      params: SyncParams(lastSyncTime: EVYSyncState.lastSyncTimestamp),
      expecting: SyncResponse.self
    )

    for row in response.data {
      try publicStore.applySyncedValue(
        namespace: row.service, resource: row.resource, value: row.value)
    }

    EVYSyncState.markSynced()
  }
}
