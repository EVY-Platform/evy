//
//  EVYDataStore.swift
//  evy
//
//  Created by Geoffroy Lesage on 2024.
//

import Foundation
import SwiftData

enum EVYDataError: Error {
  case keyNotFound
  case keyAlreadyExists
}

/// Bumped on every persisted mutation across every store, so caches derived
/// from stored rows can tell in O(1) whether they are stale.
@MainActor
private(set) var evyDataStoreGeneration = 0

@MainActor
final class EVYDataStore {
  private let context: ModelContext
  private var collectionJsonCache: [String: (generation: Int, value: EVYJson?)] = [:]

  private func collectionCacheKey(namespace: String, resource: String) -> String {
    "\(namespace):\(resource)"
  }

  convenience init(name: String, inMemoryOnly: Bool = false) {
    let config = ModelConfiguration(name, isStoredInMemoryOnly: inMemoryOnly)
    if !inMemoryOnly {
      Self.createStoreDirectory(for: config)
    }
    do {
      let container = try ModelContainer(for: EVYData.self, configurations: config)
      self.init(container: container)
    } catch {
      if !inMemoryOnly {
        Self.deleteStoreFiles(for: config)
      }
      let container = try! ModelContainer(for: EVYData.self, configurations: config)
      self.init(container: container)
    }
  }

  private static func createStoreDirectory(for config: ModelConfiguration) {
    try? FileManager.default.createDirectory(
      at: config.url.deletingLastPathComponent(), withIntermediateDirectories: true)
  }

  private static func deleteStoreFiles(for config: ModelConfiguration) {
    let url = config.url
    let fileManager = FileManager.default
    for suffix in ["", "-wal", "-shm"] {
      let fileURL = url.deletingPathExtension().appendingPathExtension("store\(suffix)")
      try? fileManager.removeItem(at: fileURL)
    }
  }

  init(container: ModelContainer) {
    self.context = ModelContext(container)
  }

  func get(namespace: String, resource: String, id: String) throws -> EVYData {
    let descriptor = FetchDescriptor<EVYData>(
      predicate: #Predicate {
        $0.namespace == namespace && $0.resource == resource && $0.id == id
      }
    )
    guard let first = try context.fetch(descriptor).first else {
      throw EVYDataError.keyNotFound
    }
    return first
  }

  func getAll(namespace: String, resource: String) throws -> [EVYData] {
    let descriptor = FetchDescriptor<EVYData>(
      predicate: #Predicate {
        $0.namespace == namespace && $0.resource == resource
      },
      sortBy: [SortDescriptor<EVYData>(\.sortIndex)]
    )
    return try context.fetch(descriptor)
  }

  func getAll(namespace: String) throws -> [EVYData] {
    let descriptor = FetchDescriptor<EVYData>(
      predicate: #Predicate { $0.namespace == namespace }
    )
    return try context.fetch(descriptor)
  }

  func getAll() throws -> [EVYData] {
    let descriptor = FetchDescriptor<EVYData>()
    return try context.fetch(descriptor)
  }

  func getFirst(namespace: String, resource: String) throws -> EVYData {
    var descriptor = FetchDescriptor<EVYData>(
      predicate: #Predicate {
        $0.namespace == namespace && $0.resource == resource
      },
      sortBy: [SortDescriptor<EVYData>(\.sortIndex)]
    )
    descriptor.fetchLimit = 1
    guard let first = try context.fetch(descriptor).first else {
      throw EVYDataError.keyNotFound
    }
    return first
  }

  /// Manual ModelContext does not autosave; call after mutations.
  func persistChanges() throws {
    try context.save()
    evyDataStoreGeneration += 1
  }

  func create(namespace: String, resource: String, id: String, value: Data, sortIndex: Int = 0)
    throws
  {
    if (try? get(namespace: namespace, resource: resource, id: id)) != nil {
      throw EVYDataError.keyAlreadyExists
    }
    context.insert(
      EVYData(namespace: namespace, resource: resource, id: id, data: value, sortIndex: sortIndex)
    )
    try persistChanges()
    postRecordAndValueChanged(namespace: namespace, resource: resource, id: id)
  }

  func update(namespace: String, resource: String, id: String, value: Data, sortIndex: Int = 0)
    throws
  {
    let existing = try get(namespace: namespace, resource: resource, id: id)
    existing.data = value
    existing.sortIndex = sortIndex
    try persistChanges()
    postRecordAndValueChanged(namespace: namespace, resource: resource, id: id)
  }

  // used by tests
  func delete(namespace: String, resource: String, id: String) throws {
    let existing = try get(namespace: namespace, resource: resource, id: id)
    context.delete(existing)
    try persistChanges()
    postRecordAndValueChanged(namespace: namespace, resource: resource, id: id)
  }

  func deleteAll(namespace: String, resource: String) throws {
    let rows = try getAll(namespace: namespace, resource: resource)
    for row in rows {
      context.delete(row)
    }
    try persistChanges()
    postValueChanged(key: resource)
  }

  func deleteAll(namespace: String) throws {
    let rows = try getAll(namespace: namespace)
    for row in rows {
      context.delete(row)
    }
    try persistChanges()
  }

  func wipeAll() throws {
    let rows = try getAll()
    for row in rows {
      context.delete(row)
    }
    try persistChanges()
  }

  func upsert(namespace: String, resource: String, id: String, value: Data, sortIndex: Int = 0)
    throws
  {
    try upsertWithoutPersist(
      namespace: namespace, resource: resource, id: id, value: value, sortIndex: sortIndex)
    try persistChanges()
    postRecordAndValueChanged(namespace: namespace, resource: resource, id: id)
  }

  private func upsertWithoutPersist(
    namespace: String, resource: String, id: String, value: Data, sortIndex: Int = 0
  ) throws {
    if let existing = try? get(namespace: namespace, resource: resource, id: id) {
      existing.data = value
      existing.sortIndex = sortIndex
    } else {
      context.insert(
        EVYData(namespace: namespace, resource: resource, id: id, data: value, sortIndex: sortIndex)
      )
    }
  }

  func applySyncedValue(namespace: String, resource: String, value: EVYJson) throws {
    if case .array(let items) = value {
      try applySyncedItems(namespace: namespace, resource: resource, items: items)
      return
    }

    let encoded = try JSONEncoder().encode(value)
    let itemId = singletonId(for: value)
    let existingSortIndex = (try? get(namespace: namespace, resource: resource, id: itemId))?
      .sortIndex
    let sortIndex = existingSortIndex ?? nextSortIndex(namespace: namespace, resource: resource)
    try upsert(
      namespace: namespace, resource: resource, id: itemId, value: encoded, sortIndex: sortIndex)
  }

  func nextSortIndex(namespace: String, resource: String) -> Int {
    let maxExisting = (try? getAll(namespace: namespace, resource: resource))?.map(\.sortIndex)
      .max()
    return (maxExisting ?? -1) + 1
  }

  private func applySyncedItems(namespace: String, resource: String, items: [EVYJson]) throws {
    for (sortIndex, item) in items.enumerated() {
      let itemId = item.identifierValue()
      guard !itemId.isEmpty else { continue }
      guard let encoded = try? JSONEncoder().encode(item) else { continue }
      try upsertWithoutPersist(
        namespace: namespace, resource: resource, id: itemId, value: encoded, sortIndex: sortIndex)
    }
    try persistChanges()
    postValueChanged(key: resource)
  }

  private func singletonId(for value: EVYJson) -> String {
    if case .dictionary(let dict) = value, case .string(let idVal) = dict["id"] {
      return idVal
    }
    return EVYNamespace.singletonId
  }

  func getCollectionJson(namespace: String, resource: String) throws -> EVYJson? {
    let cacheKey = collectionCacheKey(namespace: namespace, resource: resource)
    if let cached = collectionJsonCache[cacheKey],
      cached.generation == evyDataStoreGeneration
    {
      return cached.value
    }

    let rows = try getAll(namespace: namespace, resource: resource)
    guard !rows.isEmpty else {
      collectionJsonCache[cacheKey] = (evyDataStoreGeneration, nil)
      return nil
    }

    let items: [EVYJson] = rows.compactMap { try? $0.decoded() }
    let collection = EVYJson.array(items)
    collectionJsonCache[cacheKey] = (evyDataStoreGeneration, collection)
    return collection
  }

  func getJsonForBinding(key: String, cacheScopeId: String?) throws -> EVYJson {
    if let cacheScopeId,
      let cached = try? get(
        namespace: EVYNamespace.cache, resource: cacheScopeId, id: key)
    {
      return try cached.decoded()
    }

    if let localInstance = try? get(
      namespace: EVYNamespace.local, resource: key, id: EVYNamespace.singletonId)
    {
      return try localInstance.decoded()
    }

    throw EVYDataError.keyNotFound
  }

  func postValueChanged(key: String?) {
    EVYValueChange.post(key: key)
  }

  private func postRecordAndValueChanged(namespace: String, resource: String, id: String) {
    let change = EVYRecordChange(namespace: namespace, resource: resource, id: id)
    NotificationCenter.default.post(
      name: .evyRecordChanged,
      object: change.recordKey,
      userInfo: [EVYRecordChange.userInfoKey: change]
    )
    postValueChanged(key: resource)
  }
}
