//
//  EVY+Sync.swift
//  evy
//

import Foundation

extension EVY {
  static func sync() async throws {
    let declaredOwnership = declaredOwnershipFingerprint()
    let cursor =
      declaredOwnership == EVYSyncState.declaredOwnership ? EVYSyncState.cursor : nil

    let response: SyncResponse = try await EVYAPIManager.shared.fetch(
      method: "sync",
      params: SyncParams(
        cursor: cursor,
        ownedServiceResources: ownedServiceResources()
      ),
      expecting: SyncResponse.self
    )

    let assignsOrder = cursor == nil
    for row in response.data {
      try applySyncedValue(
        namespace: row.service, resource: row.resource, value: row.value,
        assignsOrder: assignsOrder)
    }

    // Partial sync must not advance the cursor.
    if let errors = response.errors, !errors.isEmpty {
      let summary = errors.map { "\($0.resource): \($0.message)" }
        .joined(separator: "; ")
      NotificationCenter.default.post(
        name: .evyErrorOccurred,
        object: EVYError.invalidData(context: "sync was incomplete - \(summary)")
      )
      return
    }

    EVYSyncState.markSynced(
      cursor: response.cursor, declaredOwnership: declaredOwnership)
  }
}
