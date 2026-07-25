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

    // A partial sync must not advance the cursor, or the resources that failed
    // would never be retried. The rows that did arrive are still applied.
    if let errors = response.errors, !errors.isEmpty {
      let summary = errors.map { "\($0.resource): \($0.message)" }
        .joined(separator: "; ")
      NotificationCenter.default.post(
        name: .evyErrorOccurred,
        object: EVYError.invalidData(context: "sync was incomplete - \(summary)")
      )
      return
    }

    EVYSyncState.markSynced(cursor: response.cursor)
  }
}
