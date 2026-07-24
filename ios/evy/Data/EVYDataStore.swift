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

@MainActor
final class EVYDataStore {
  private let context: ModelContext

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

  /// Flushes pending changes to disk. The context is created manually (not the
  /// container's mainContext), so it never autosaves — without an explicit save,
  /// synced data is silently lost when the process exits, and the next launch
  /// combines an empty store with a fresh lastSyncTimestamp and cannot recover.
  /// Also used for mutations made directly on fetched `EVYData` models (e.g.
  /// in-place `row.data` edits) that bypass create/update/delete.
  func persistChanges() throws {
    try context.save()
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
    if (try? get(namespace: namespace, resource: resource, id: id)) != nil {
      try update(
        namespace: namespace, resource: resource, id: id, value: value, sortIndex: sortIndex)
    } else {
      try create(
        namespace: namespace, resource: resource, id: id, value: value, sortIndex: sortIndex)
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
      try upsert(
        namespace: namespace, resource: resource, id: itemId, value: encoded, sortIndex: sortIndex)
    }
  }

  private func singletonId(for value: EVYJson) -> String {
    if case .dictionary(let dict) = value, case .string(let idVal) = dict["id"] {
      return idVal
    }
    return EVYNamespace.singletonId
  }

  func getCollectionJson(namespace: String, resource: String) throws -> EVYJson? {
    let rows = try getAll(namespace: namespace, resource: resource)
    guard !rows.isEmpty else { return nil }

    let items: [EVYJson] = rows.compactMap { try? $0.decoded() }
    return .array(items)
  }

  func getJsonForBinding(key: String, cacheScopeId: String?) throws -> EVYJson {
    if !key.contains(":") {
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

      if let namespace = namespace(forSyncedResource: key),
        let collection = try getCollectionJson(namespace: namespace, resource: key)
      {
        return collection
      }

      throw EVYDataError.keyNotFound
    }

    let parts = key.split(separator: ":", maxSplits: 1).map(String.init)
    guard parts.count == 2 else { throw EVYDataError.keyNotFound }

    let first = parts[0]
    let second = parts[1]

    if let collection = try getCollectionJson(namespace: first, resource: second) {
      return collection
    }

    if let instance = try? get(namespace: first, resource: second, id: EVYNamespace.singletonId) {
      return try instance.decoded()
    }

    throw EVYDataError.keyNotFound
  }

  func namespace(forSyncedResource resource: String) -> String? {
    var descriptor = FetchDescriptor<EVYData>(
      predicate: #Predicate {
        $0.resource == resource
      }
    )
    descriptor.fetchLimit = 1
    guard let row = try? context.fetch(descriptor).first else { return nil }
    let validNamespaces = [EVYNamespace.local, EVYNamespace.cache, EVYNamespace.draft]
    guard !validNamespaces.contains(row.namespace) else { return nil }
    return row.namespace
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
