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

  func postDataUpdated(key: String) {
    NotificationCenter.default.post(
      name: Notification.Name.evyDataUpdated,
      object: key
    )
  }
}
