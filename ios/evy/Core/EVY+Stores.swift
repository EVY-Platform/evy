//
//  EVY+Stores.swift
//  evy
//

import Foundation

extension EVY {
  static func storeForSyncedRecord(_ value: EVYJson) -> EVYDataStore {
    if case .dictionary(let record) = value,
      case .string(let visibility) = record["visibility"],
      visibility == "private"
    {
      return privateStore
    }
    return publicStore
  }

  static func syncedStores() -> [EVYDataStore] {
    [publicStore, privateStore]
  }

  static func otherSyncedStore(than store: EVYDataStore) -> EVYDataStore {
    store === publicStore ? privateStore : publicStore
  }

  /// Applies synced rows, removing any the server has tombstoned.
  ///
  /// `assignsOrder` is true only for a full sync: an incremental response
  /// contains just the rows that changed, so its positions say nothing about
  /// where those rows belong in the collection.
  static func applySyncedValue(
    namespace: String,
    resource: String,
    value: EVYJson,
    assignsOrder: Bool = true
  ) throws {
    if case .array(let items) = value {
      for (position, item) in items.enumerated() {
        if isTombstoned(item) {
          try removeSyncedRecord(namespace: namespace, resource: resource, value: item)
          continue
        }
        try applySyncedRecord(
          namespace: namespace,
          resource: resource,
          value: item,
          sortIndex: assignsOrder ? position : nil
        )
      }
      return
    }

    if isTombstoned(value) {
      try removeSyncedRecord(namespace: namespace, resource: resource, value: value)
      return
    }
    try applySyncedRecord(namespace: namespace, resource: resource, value: value)
  }

  /// A record the server has deleted. `deleted_at` is absent on live records.
  private static func isTombstoned(_ value: EVYJson) -> Bool {
    guard case .dictionary(let record) = value else { return false }
    guard let deleted_at = record["deleted_at"] else { return false }
    if case .null = deleted_at { return false }
    return true
  }

  private static func applySyncedRecord(
    namespace: String,
    resource: String,
    value: EVYJson,
    sortIndex: Int? = nil
  ) throws {
    let targetStore = storeForSyncedRecord(value)
    let recordId = syncedRecordId(for: value)
    // An existing row keeps the position it already has: re-ordering must come
    // from a full sync, never from a delta that happens to include it.
    let resolvedSortIndex =
      (try? targetStore.get(namespace: namespace, resource: resource, id: recordId))?
      .sortIndex
      ?? sortIndex
      ?? targetStore.nextSortIndex(namespace: namespace, resource: resource)

    let encoded = try JSONEncoder().encode(value)
    try targetStore.upsert(
      namespace: namespace,
      resource: resource,
      id: recordId,
      value: encoded,
      sortIndex: resolvedSortIndex
    )

    let counterpartStore = otherSyncedStore(than: targetStore)
    if (try? counterpartStore.get(namespace: namespace, resource: resource, id: recordId)) != nil {
      try counterpartStore.delete(namespace: namespace, resource: resource, id: recordId)
    }
  }

  /// Removes records the server reported as deleted. Without this a `delete`
  /// notification would fall through to the upsert path and resurrect the row.
  static func removeSyncedValue(namespace: String, resource: String, value: EVYJson) throws {
    if case .array(let items) = value {
      for item in items {
        try removeSyncedRecord(namespace: namespace, resource: resource, value: item)
      }
      return
    }

    try removeSyncedRecord(namespace: namespace, resource: resource, value: value)
  }

  private static func removeSyncedRecord(
    namespace: String,
    resource: String,
    value: EVYJson
  ) throws {
    let recordId = syncedRecordId(for: value)
    // Visibility may have changed before the delete, so clear both stores.
    for store in syncedStores()
    where (try? store.get(namespace: namespace, resource: resource, id: recordId)) != nil {
      try store.delete(namespace: namespace, resource: resource, id: recordId)
    }
  }

  private static func syncedRecordId(for value: EVYJson) -> String {
    if case .dictionary(let dict) = value, case .string(let idVal) = dict["id"] {
      return idVal
    }
    return EVYNamespace.singletonId
  }

  static func getSyncedJsonForRef(_ ref: String) throws -> EVYJson {
    let namespace = try EVYResourceRef.serviceOf(ref)
    if let collection = try getSyncedCollectionJson(namespace: namespace, resource: ref) {
      return collection
    }
    for store in syncedStores() {
      if let row = try? store.get(namespace: namespace, resource: ref, id: EVYNamespace.singletonId)
      {
        return try row.decoded()
      }
    }
    throw EVYDataError.keyNotFound
  }

  static func getSyncedCollectionJson(namespace: String, resource: String) throws -> EVYJson? {
    if let collection = try? publicStore.getCollectionJson(
      namespace: namespace, resource: resource)
    {
      return collection
    }
    return try privateStore.getCollectionJson(namespace: namespace, resource: resource)
  }
}
