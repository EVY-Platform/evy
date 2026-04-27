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

  convenience init(name: String) {
    let container = try! ModelContainer(
      for: EVYData.self,
      configurations: ModelConfiguration(name, isStoredInMemoryOnly: true)
    )
    self.init(container: container)
  }

  init(container: ModelContainer) {
    self.context = ModelContext(container)
  }

  func exists(key: String) -> Bool {
    (try? get(key: key)) != nil
  }

  func get(key: String) throws -> EVYData {
    let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
    guard let first = try context.fetch(descriptor).first else {
      throw EVYDataError.keyNotFound
    }
    return first
  }

  func getForBinding(key: String) throws -> EVYData {
    if let exact = try? get(key: key) {
      return exact
    }

    let suffix = ":\(key)"
    let descriptor = FetchDescriptor<EVYData>()
    guard let first = try context.fetch(descriptor).first(where: { $0.key.hasSuffix(suffix) })
    else {
      throw EVYDataError.keyNotFound
    }
    return first
  }

  func getAll(keyPrefix: String? = nil) throws -> [EVYData] {
    let descriptor = FetchDescriptor<EVYData>()
    let rows = try context.fetch(descriptor)
    guard let keyPrefix else {
      return rows
    }
    return rows.filter { $0.key.hasPrefix(keyPrefix) }
  }

  func create(key: String, data: Data) throws {
    if exists(key: key) {
      throw EVYDataError.keyAlreadyExists
    }
    context.insert(EVYData(key: key, data: data))
    postDataUpdated(key: key)
  }

  func upsert(key: String, value: Data, notify: Bool = true) throws {
    let nowIso = Date().ISO8601Format()

    if let existing = try? get(key: key) {
      existing.data = value
      existing.lastSyncedAt = nowIso
    } else {
      context.insert(EVYData(key: key, lastSyncedAt: nowIso, data: value))
    }

    guard notify else { return }

    postDataUpdated(key: key)

    // Service-qualified keys such as "marketplace:items" also notify the
    // resource name so concise SDUI bindings like "{items}" refresh.
    if let resourceKey = key.split(separator: ":").last.map(String.init),
      resourceKey != key
    {
      postDataUpdated(key: resourceKey)
    }
  }

  func update(props: [String], data: Data) throws {
    let existing = try get(key: props.first!)
    existing.data = data

    var propsForNotification = props
    if let index = props.firstIndex(where: { $0.isNumber }) {
      propsForNotification.removeLast(props.count - index)
    }

    let notifKey = propsForNotification.joined(separator: PROP_SEPARATOR)
    postDataUpdated(key: notifKey)
  }

  func delete(key: String) throws {
    let existing = try get(key: key)
    context.delete(existing)
    postDataUpdated(key: key)
  }

  func deleteAll(keyPrefix: String? = nil) {
    do {
      let rows = try getAll(keyPrefix: keyPrefix)
      for row in rows {
        context.delete(row)
      }
    } catch {
      #if DEBUG
        print("[EVYDataStore] deleteAll error: \(error)")
      #endif
    }
  }

  private func postDataUpdated(key: String) {
    NotificationCenter.default.post(
      name: Notification.Name.evyDataUpdated,
      object: key
    )
  }
}
