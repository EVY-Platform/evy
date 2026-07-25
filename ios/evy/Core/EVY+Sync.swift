//
//  EVY+Sync.swift
//  evy
//

import Foundation

extension EVY {
  static func sync() async throws {
    if EVYSyncState.storageVersionDidChange {
      try wipeSyncedStores()
      EVYSyncState.storageVersionDidChange = false
    }

    let cursor = EVYSyncState.cursor
    let response: SyncResponse = try await EVYAPIManager.shared.fetch(
      method: "sync",
      params: SyncParams(cursor: cursor),
      expecting: SyncResponse.self
    )

    // A full sync defines collection order; a delta must not, or a single
    // changed row would renumber everything around it.
    let assignsOrder = cursor == nil
    for row in response.data {
      try applySyncedValue(
        namespace: row.service, resource: row.resource, value: row.value,
        assignsOrder: assignsOrder)
    }

    EVYSyncState.markSynced(cursor: response.cursor)
  }
}
