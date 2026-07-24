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

  static func wipeSyncedStores() throws {
    try publicStore.wipeAll()
    try privateStore.wipeAll()
  }

  static func applySyncedValue(namespace: String, resource: String, value: EVYJson) throws {
    if case .array(let items) = value {
      for (sortIndex, item) in items.enumerated() {
        try applySyncedRecord(
          namespace: namespace,
          resource: resource,
          value: item,
          sortIndex: sortIndex
        )
      }
      return
    }

    try applySyncedRecord(namespace: namespace, resource: resource, value: value)
  }

  private static func applySyncedRecord(
    namespace: String,
    resource: String,
    value: EVYJson,
    sortIndex: Int? = nil
  ) throws {
    let targetStore = storeForSyncedRecord(value)
    let recordId = syncedRecordId(for: value)
    let resolvedSortIndex =
      sortIndex
      ?? (try? targetStore.get(namespace: namespace, resource: resource, id: recordId))?
      .sortIndex
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

  private static func syncedRecordId(for value: EVYJson) -> String {
    if case .dictionary(let dict) = value, case .string(let idVal) = dict["id"] {
      return idVal
    }
    return EVYNamespace.singletonId
  }

  static func getSyncedJsonForBinding(key: String, cacheScopeId: String?) throws -> EVYJson {
    do {
      return try publicStore.getJsonForBinding(key: key, cacheScopeId: cacheScopeId)
    } catch EVYDataError.keyNotFound {
      return try privateStore.getJsonForBinding(key: key, cacheScopeId: cacheScopeId)
    }
  }

  static func getSyncedCollectionJson(namespace: String, resource: String) throws -> EVYJson? {
    if let collection = try? publicStore.getCollectionJson(
      namespace: namespace, resource: resource)
    {
      return collection
    }
    return try privateStore.getCollectionJson(namespace: namespace, resource: resource)
  }

  static func namespaceForSyncedResource(_ resource: String) -> String? {
    publicStore.namespace(forSyncedResource: resource)
      ?? privateStore.namespace(forSyncedResource: resource)
  }

  static func findSyncedRow(matching resource: String) throws -> (row: EVYData, store: EVYDataStore)
  {
    for store in syncedStores() {
      let allRows = (try? store.getAll()) ?? []
      if let matched = allRows.first(where: { $0.resource == resource }) {
        return (matched, store)
      }
    }
    throw EVYDataError.keyNotFound
  }
}
