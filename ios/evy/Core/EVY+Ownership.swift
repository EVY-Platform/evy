//
//  EVY+Ownership.swift
//  evy
//

import Foundation

/// Created records, keyed by `(service, resource, id)`. Public records still need
/// an owner for message entitlement; visibility alone cannot express that.
enum EVYOwnershipLedger {
  private static let key = "ownedRecords"

  private struct Entry: Codable, Hashable {
    let service: String
    let resource: String
    let id: String
  }

  private static var cachedEntries: Set<Entry>?

  private static var entries: Set<Entry> {
    get {
      if let cachedEntries {
        return cachedEntries
      }
      guard let data = UserDefaults.standard.data(forKey: key),
        let decoded = try? JSONDecoder().decode(Set<Entry>.self, from: data)
      else {
        cachedEntries = []
        return []
      }
      cachedEntries = decoded
      return decoded
    }
    set {
      cachedEntries = newValue
      guard let data = try? JSONEncoder().encode(newValue) else { return }
      UserDefaults.standard.set(data, forKey: key)
    }
  }

  static func record(service: String, resource: String, id: String) {
    entries.insert(Entry(service: service, resource: resource, id: id))
  }

  static func recordedIds() -> [(service: String, resource: String, id: String)] {
    entries.map { ($0.service, $0.resource, $0.id) }
  }

  // used by tests
  static func reset() {
    cachedEntries = nil
    UserDefaults.standard.removeObject(forKey: key)
  }
}

extension EVY {
  private struct OwnedServiceResourceKey: Hashable {
    let service: String
    let resource: String
  }

  static func recordOwnership(service: String, resource: String, id: String) {
    EVYOwnershipLedger.record(service: service, resource: resource, id: id)
  }

  private struct OwnedMembershipKey: Hashable {
    let service: String
    let resource: String
    let id: String
  }

  @MainActor
  private static var ownedMembershipCache: (generation: Int, members: Set<OwnedMembershipKey>)?

  @MainActor
  private static func ownedMembershipSet() -> Set<OwnedMembershipKey> {
    if let cache = ownedMembershipCache, cache.generation == evyDataStoreGeneration {
      return cache.members
    }

    var members = Set<OwnedMembershipKey>()
    for record in EVYOwnershipLedger.recordedIds() {
      members.insert(
        OwnedMembershipKey(service: record.service, resource: record.resource, id: record.id))
    }
    for row in (try? privateStore.getAll()) ?? []
    where isSyncedNamespace(row.namespace) {
      members.insert(
        OwnedMembershipKey(service: row.namespace, resource: row.resource, id: row.id))
    }
    for declared in preownedServiceResources {
      for id in declared.ids {
        members.insert(
          OwnedMembershipKey(service: declared.service, resource: declared.resource, id: id))
      }
    }

    ownedMembershipCache = (evyDataStoreGeneration, members)
    return members
  }

  static func ownsRecord(service: String, resource: String, id: String) -> Bool {
    ownedMembershipSet().contains(
      OwnedMembershipKey(service: service, resource: resource, id: id))
  }

  static func ownedServiceResources() -> [OwnedServiceResource] {
    var idsByKey: [OwnedServiceResourceKey: Set<String>] = [:]

    for member in ownedMembershipSet() {
      idsByKey[.init(service: member.service, resource: member.resource), default: []]
        .insert(member.id)
    }

    let owned =
      idsByKey
      .map {
        OwnedServiceResource(
          service: $0.key.service, resource: $0.key.resource, ids: $0.value.sorted())
      }
      .sorted { ($0.service, $0.resource) < ($1.service, $1.resource) }

    assert(
      owned.allSatisfy { $0.ids.allSatisfy(isEvyRecordId) },
      "ownedServiceResources must only contain record ids: \(owned)")

    return owned
  }

  private static func isSyncedNamespace(_ namespace: String) -> Bool {
    namespace != EVYNamespace.local
      && namespace != EVYNamespace.cache
      && namespace != EVYNamespace.draft
  }

  /// Launch override for seeded ownership until auth lands.
  private static let preownedServiceResources: [OwnedServiceResource] = {
    guard
      let raw = ProcessInfo.processInfo.environment["EVY_OWNED_SERVICE_RESOURCES"],
      let data = raw.data(using: .utf8),
      let decoded = try? JSONDecoder().decode([OwnedServiceResource].self, from: data)
    else {
      return []
    }
    return decoded
  }()

  /// Fingerprint of declared ownership; a change invalidates the sync cursor.
  static func declaredOwnershipFingerprint() -> String {
    preownedServiceResources
      .map { "\($0.service)/\($0.resource):\($0.ids.sorted().joined(separator: ","))" }
      .sorted()
      .joined(separator: ";")
  }
}
