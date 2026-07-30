//
//  EVY+Ownership.swift
//  evy
//

import Foundation

/// Created records, keyed by `(service, resource, id)`. Public records still need
/// an owner for message entitlement; visibility alone cannot express that.
enum EVYOwnershipLedger {
  private static let key = "ownedRecords"

  fileprivate struct Entry: Codable, Hashable {
    let service: String
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

  fileprivate static func record(service: String, resource: String, id: String) {
    entries.insert(Entry(service: service, resource: resource, id: id))
  }

  // used by tests
  static func reset() {
    cachedEntries = nil
    UserDefaults.standard.removeObject(forKey: key)
  }
}

extension EVY {
  static func recordOwnership(service: String, resource: String, id: String) {
    EVYOwnershipLedger.record(service: service, resource: resource, id: id)
  }

  private struct OwnedMembershipKey: Hashable {
    let service: String
    let resource: String
    let id: String
  }

  private struct ServiceResourceKey: Hashable {
    let service: String
    let resource: String
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
      members.insert(
        OwnedMembershipKey(service: entry.service, resource: entry.resource, id: entry.id))
    }
    for row in (try? privateStore.getAll()) ?? []
    where isSyncedNamespace(row.namespace) {
      members.insert(
        OwnedMembershipKey(service: row.namespace, resource: row.resource, id: row.id))
    }
    for declared in preowned_service_resources {
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

  static func owned_service_resources() -> [OwnedServiceResource] {
    let grouped = Dictionary(grouping: ownedMembershipSet()) { member in
      ServiceResourceKey(service: member.service, resource: member.resource)
    }

    return
      grouped
      .map { serviceResource, members in
        OwnedServiceResource(
          service: serviceResource.service,
          resource: serviceResource.resource,
          ids: members.map(\.id).filter(isEvyRecordId).sorted())
      }
      .filter { !$0.ids.isEmpty }
      .sorted { ($0.service, $0.resource) < ($1.service, $1.resource) }
  }

  private static func isSyncedNamespace(_ namespace: String) -> Bool {
    namespace != EVYNamespace.local
      && namespace != EVYNamespace.cache
      && namespace != EVYNamespace.draft
  }

  /// Launch override for seeded ownership until auth lands.
  private static let preowned_service_resources: [OwnedServiceResource] = {
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
    preowned_service_resources
      .map { "\($0.service)/\($0.resource):\($0.ids.sorted().joined(separator: ","))" }
      .sorted()
      .joined(separator: ";")
  }
}
