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

    let response: SyncResponse = try await EVYAPIManager.shared.fetch(
      method: "api",
      params: CoreAPIParams(
        service: EVY_CORE_SERVICE,
        method: "sync",
        data: SyncParams(lastSyncTime: EVYSyncState.lastSyncTimestamp)
      ),
      expecting: SyncResponse.self
    )

    for row in response.data {
      try applySyncedValue(
        namespace: row.service, resource: row.resource, value: row.value)
    }

    EVYSyncState.markSynced()
  }
}
