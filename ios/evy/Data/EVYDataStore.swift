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

  func oldestLastSyncedAt(keyPrefix: String? = nil) -> String? {
    var emptyDescriptor: FetchDescriptor<EVYData>
    var oldestDescriptor: FetchDescriptor<EVYData>
    let forwardSort = [SortDescriptor(\EVYData.lastSyncedAt, order: .forward)]

    if let keyPrefix {
      let upperBound = upperBound(for: keyPrefix)
      emptyDescriptor = FetchDescriptor<EVYData>(
        predicate: #Predicate {
          $0.key >= keyPrefix && $0.key < upperBound && $0.lastSyncedAt == ""
        }
      )
      oldestDescriptor = FetchDescriptor<EVYData>(
        predicate: #Predicate {
          $0.key >= keyPrefix && $0.key < upperBound && $0.lastSyncedAt > ""
        },
        sortBy: forwardSort
      )
    } else {
      emptyDescriptor = FetchDescriptor<EVYData>(
        predicate: #Predicate { $0.lastSyncedAt == "" }
      )
      oldestDescriptor = FetchDescriptor<EVYData>(
        predicate: #Predicate { $0.lastSyncedAt > "" },
        sortBy: forwardSort
      )
    }

    emptyDescriptor.fetchLimit = 1
    let hasEmpty = (try? context.fetch(emptyDescriptor).first) != nil
    guard !hasEmpty else { return nil }

    oldestDescriptor.fetchLimit = 1
    return try? context.fetch(oldestDescriptor).first?.lastSyncedAt
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

  private func upperBound(for prefix: String) -> String {
    var result = prefix
    guard let last = result.unicodeScalars.popLast(),
          let next = UnicodeScalar(last.value + 1) else { return prefix }
    result.unicodeScalars.append(next)
    return result
  }
}
