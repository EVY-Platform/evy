//
//  EVY+Ownership.swift
//  evy
//

import Foundation

/// Created records, keyed by `(resource ref, id)`. Public records still need
/// an owner for message entitlement; visibility alone cannot express that.
enum EVYOwnershipLedger {
  private static let key = "ownedRecords"

  fileprivate struct Entry: Codable, Hashable {
    let resource: String
    let id: String
  }

  private static var cachedEntries: Set<Entry>?

  fileprivate static var entries: Set<Entry> {
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

  fileprivate static func record(resource: String, id: String) {
    entries.insert(Entry(resource: resource, id: id))
  }

  // used by tests
  static func reset() {
    cachedEntries = nil
    UserDefaults.standard.removeObject(forKey: key)
  }
}

extension EVY {
  static func recordOwnership(resource: String, id: String) {
    EVYOwnershipLedger.record(resource: resource, id: id)
  }

  private struct OwnedMembershipKey: Hashable {
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
    for entry in EVYOwnershipLedger.entries {
      members.insert(OwnedMembershipKey(resource: entry.resource, id: entry.id))
    }
    for row in (try? privateStore.getAll()) ?? []
    where isSyncedNamespace(row.namespace) {
      members.insert(OwnedMembershipKey(resource: row.resource, id: row.id))
    }
    for declared in preownedResources {
      for id in declared.ids {
        members.insert(OwnedMembershipKey(resource: declared.resource, id: id))
      }
    }

    ownedMembershipCache = (evyDataStoreGeneration, members)
    return members
  }

  static func ownsRecord(resource: String, id: String) -> Bool {
    ownedMembershipSet().contains(OwnedMembershipKey(resource: resource, id: id))
  }

  static func ownedResources() -> [OwnedResource] {
    let grouped = Dictionary(grouping: ownedMembershipSet()) { member in
      member.resource
    }

    return
      grouped
      .map { resource, members in
        OwnedResource(
          resource: resource,
          ids: members.map(\.id).filter(isEvyRecordId).sorted())
      }
      .filter { !$0.ids.isEmpty }
      .sorted { $0.resource < $1.resource }
  }

  private static func isSyncedNamespace(_ namespace: String) -> Bool {
    !EVYResourceRef.isReservedService(namespace)
  }

  /// Launch override for seeded ownership until auth lands.
  private static let preownedResources: [OwnedResource] = {
    guard
      let raw = ProcessInfo.processInfo.environment["EVY_OWNED_RESOURCES"],
      let data = raw.data(using: .utf8),
      let decoded = try? JSONDecoder().decode([OwnedResource].self, from: data)
    else {
      return []
    }
    return decoded
  }()

  /// Fingerprint of declared ownership; a change invalidates the sync cursor.
  static func declaredOwnershipFingerprint() -> String {
    preownedResources
      .map { "\($0.resource):\($0.ids.sorted().joined(separator: ","))" }
      .sorted()
      .joined(separator: ";")
  }
}
