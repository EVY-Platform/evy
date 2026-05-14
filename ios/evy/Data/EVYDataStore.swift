//
//  EVYDataStore.swift
//  evy
//
//  Created by Geoffroy Lesage on 2024.
//

import Foundation
import SwiftData

@MainActor
final class EVYDataStore {
  private let context: ModelContext

  convenience init(name: String, inMemoryOnly: Bool = false) {
    let container = try! ModelContainer(
      for: EVYData.self,
      configurations: ModelConfiguration(name, isStoredInMemoryOnly: inMemoryOnly)
    )
    self.init(container: container)
  }

  init(container: ModelContainer) {
    self.context = ModelContext(container)
  }

  // MARK: - Normalized CRUD

  func exists(namespace: String, resource: String, id: String) -> Bool {
    (try? get(namespace: namespace, resource: resource, id: id)) != nil
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

  /// Fetch all rows matching namespace + resource (a collection).
  func getAll(namespace: String, resource: String) throws -> [EVYData] {
    let descriptor = FetchDescriptor<EVYData>(
      predicate: #Predicate {
        $0.namespace == namespace && $0.resource == resource
      }
    )
    return try context.fetch(descriptor)
  }

  /// Fetch all rows for a given namespace.
  func getAll(namespace: String) throws -> [EVYData] {
    let descriptor = FetchDescriptor<EVYData>(
      predicate: #Predicate { $0.namespace == namespace }
    )
    return try context.fetch(descriptor)
  }

  /// Fetch all rows in the store.
  func getAll() throws -> [EVYData] {
    let descriptor = FetchDescriptor<EVYData>()
    return try context.fetch(descriptor)
  }

  func upsert(
    namespace: String, resource: String, id: String, value: Data
  ) throws {
    if let existing = try? get(namespace: namespace, resource: resource, id: id) {
      existing.data = value
    } else {
      context.insert(
        EVYData(namespace: namespace, resource: resource, id: id, data: value)
      )
    }

    postDataUpdated(key: "\(namespace):\(resource):\(id)")
    postDataUpdated(key: "\(namespace):\(resource)")
    postDataUpdated(key: resource)
  }

  func delete(namespace: String, resource: String, id: String) throws {
    let existing = try get(namespace: namespace, resource: resource, id: id)
    context.delete(existing)
    postDataUpdated(key: "\(namespace):\(resource):\(id)")
    postDataUpdated(key: "\(namespace):\(resource)")
    postDataUpdated(key: resource)
  }

  func deleteAll(namespace: String, resource: String) throws {
    let rows = try getAll(namespace: namespace, resource: resource)
    for row in rows {
      context.delete(row)
    }
    postDataUpdated(key: "\(namespace):\(resource)")
    postDataUpdated(key: resource)
  }

  func deleteAll(namespace: String) throws {
    let rows = try getAll(namespace: namespace)
    for row in rows {
      context.delete(row)
    }
  }

  // MARK: - Synced Resource Helpers

  /// Normalize a sync row value into individual instances.
  func upsertSyncedValue(namespace: String, resource: String, value: EVYJson) throws {
    switch value {
    case .array(let items):
      for item in items {
        let itemId = item.identifierValue()
        guard !itemId.isEmpty else { continue }
        guard let encoded = try? JSONEncoder().encode(item) else { continue }
        try upsert(namespace: namespace, resource: resource, id: itemId, value: encoded)
      }
    case .dictionary(let dict):
      let instanceId: String
      if case .string(let idVal) = dict["id"] {
        instanceId = idVal
      } else {
        instanceId = EVYNamespace.singletonId
      }
      let encoded = try JSONEncoder().encode(value)
      try upsert(namespace: namespace, resource: resource, id: instanceId, value: encoded)
    default:
      let encoded = try JSONEncoder().encode(value)
      try upsert(
        namespace: namespace, resource: resource, id: EVYNamespace.singletonId, value: encoded)
    }
  }

  /// Decode all instances for a resource into an EVYJson array.
  func getCollectionJson(namespace: String, resource: String) throws -> EVYJson? {
    let rows = try getAll(namespace: namespace, resource: resource)
    guard !rows.isEmpty else { return nil }

    let items: [EVYJson] = rows.compactMap { try? $0.decoded() }
    return .array(items)
  }

  // MARK: - Binding Resolution

  /// Resolve a binding key (e.g. "items", "item", "marketplace:items") to
  /// the decoded EVYJson for display.
  ///
  /// Returns a collection array for plural resource bindings,
  /// or a single instance for exact/entity binding lookups.
  func getJsonForBinding(key: String) throws -> EVYJson {
    // 1. Try exact-match composite lookup (cache, local, etc.)
    // First split by ":" — if it has two parts, try namespace:resource match
    if !key.contains(":") {
      // Singular key — could be a cache binding. Check cache first.
      if let scopeId = EVY.activeCacheScopeId,
        let cached = try? get(namespace: EVYNamespace.cache, resource: scopeId, id: key)
      {
        return try cached.decoded()
      }

      // Try local/exact singleton first (exact local key wins over plural collection)
      if let localInstance = try? get(
        namespace: EVYNamespace.local, resource: key, id: EVYNamespace.singletonId)
      {
        return try localInstance.decoded()
      }

      // Try namespace lookup via resource
      if let namespace = namespace(forSyncedResource: key),
        let collection = try getCollectionJson(namespace: namespace, resource: key)
      {
        return collection
      }

      // Try plural fallback
      let pluralKey = EVY.resourceName(forEntityKey: key)
      if pluralKey != key,
        let pluralNamespace = namespace(forSyncedResource: pluralKey),
        let collection = try getCollectionJson(namespace: pluralNamespace, resource: pluralKey)
      {
        return collection
      }

      throw EVYDataError.keyNotFound
    }

    // 2. Key contains ":" — try as namespace:resource or draft/scopeId
    let parts = key.split(separator: ":", maxSplits: 1).map(String.init)
    guard parts.count == 2 else { throw EVYDataError.keyNotFound }

    let first = parts[0]
    let second = parts[1]

    // Try as namespace:resource collection
    if let collection = try getCollectionJson(namespace: first, resource: second) {
      return collection
    }

    // Try as namespace:resource:id
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

  // MARK: - Notifications

  func postDataUpdated(key: String) {
    NotificationCenter.default.post(
      name: Notification.Name.evyDataUpdated,
      object: key
    )
  }
}
