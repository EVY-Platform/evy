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
    let config = ModelConfiguration(name, isStoredInMemoryOnly: inMemoryOnly)
    do {
      let container = try ModelContainer(for: EVYData.self, configurations: config)
      self.init(container: container)
    } catch {
      // Schema likely changed; delete old store and retry
      if !inMemoryOnly {
        Self.deleteStoreFiles(for: config)
      }
      let container = try! ModelContainer(for: EVYData.self, configurations: config)
      self.init(container: container)
    }
  }

  private static func deleteStoreFiles(for config: ModelConfiguration) {
    let url = config.url
    let fm = FileManager.default
    // SwiftData stores use .store with WAL/SHM sidecars
    for suffix in ["", "-wal", "-shm"] {
      let fileURL = url.deletingPathExtension().appendingPathExtension("store\(suffix)")
      try? fm.removeItem(at: fileURL)
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
      }
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

  func create(namespace: String, resource: String, id: String, value: Data) throws {
    if (try? get(namespace: namespace, resource: resource, id: id)) != nil {
      throw EVYDataError.keyAlreadyExists
    }
    context.insert(
      EVYData(namespace: namespace, resource: resource, id: id, data: value)
    )
    postDataChanged(key: "\(namespace):\(resource):\(id)")
    postDataChanged(key: "\(namespace):\(resource)")
    postDataChanged(key: resource)
  }

  func update(namespace: String, resource: String, id: String, value: Data) throws {
    let existing = try get(namespace: namespace, resource: resource, id: id)
    existing.data = value
    postDataChanged(key: "\(namespace):\(resource):\(id)")
    postDataChanged(key: "\(namespace):\(resource)")
    postDataChanged(key: resource)
  }

  func delete(namespace: String, resource: String, id: String) throws {
    let existing = try get(namespace: namespace, resource: resource, id: id)
    context.delete(existing)
    postDataChanged(key: "\(namespace):\(resource):\(id)")
    postDataChanged(key: "\(namespace):\(resource)")
    postDataChanged(key: resource)
  }

  func deleteAll(namespace: String, resource: String) throws {
    let rows = try getAll(namespace: namespace, resource: resource)
    for row in rows {
      context.delete(row)
    }
    postDataChanged(key: "\(namespace):\(resource)")
    postDataChanged(key: resource)
  }

  func deleteAll(namespace: String) throws {
    let rows = try getAll(namespace: namespace)
    for row in rows {
      context.delete(row)
    }
  }

  func upsert(namespace: String, resource: String, id: String, value: Data) throws {
    if (try? get(namespace: namespace, resource: resource, id: id)) != nil {
      try update(namespace: namespace, resource: resource, id: id, value: value)
    } else {
      try create(namespace: namespace, resource: resource, id: id, value: value)
    }
  }

  func applySyncedValue(namespace: String, resource: String, value: EVYJson) throws {
    switch value {
    case .array(let items):
      for item in items {
        let itemId = item.identifierValue()
        guard !itemId.isEmpty else { continue }
        guard let encoded = try? JSONEncoder().encode(item) else { continue }
        try upsert(namespace: namespace, resource: resource, id: itemId, value: encoded)
      }
    default:
      let instanceId: String
      if case .dictionary(let dict) = value, case .string(let idVal) = dict["id"] {
        instanceId = idVal
      } else {
        instanceId = EVYNamespace.singletonId
      }
      let encoded = try JSONEncoder().encode(value)
      try upsert(namespace: namespace, resource: resource, id: instanceId, value: encoded)
    }
  }

  func getCollectionJson(namespace: String, resource: String) throws -> EVYJson? {
    let rows = try getAll(namespace: namespace, resource: resource)
    guard !rows.isEmpty else { return nil }

    let items: [EVYJson] = rows.compactMap { try? $0.decoded() }
    return .array(items)
  }

  func getJsonForBinding(key: String) throws -> EVYJson {
    if !key.contains(":") {
      if let scopeId = EVY.activeCacheScopeId,
        let cached = try? get(namespace: EVYNamespace.cache, resource: scopeId, id: key)
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

      let pluralKey = EVY.resourceName(forEntityKey: key)
      if pluralKey != key,
        let pluralNamespace = namespace(forSyncedResource: pluralKey),
        let collection = try getCollectionJson(namespace: pluralNamespace, resource: pluralKey)
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

  func postDataChanged(key: String) {
    NotificationCenter.default.post(
      name: Notification.Name.evyDataChanged,
      object: key
    )
  }
}
