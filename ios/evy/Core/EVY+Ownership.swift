//
//  EVY+Ownership.swift
//  evy
//

import Foundation

/// Records this device created, as `(service, resource, id)`.
///
/// A created record is owned however it is stored. A marketplace item is public so
/// every device can see the catalogue, and its seller still has to own it to receive
/// messages about it - `visibility` cannot express that, because it is one global
/// column saying which store a row goes in, not who it belongs to. So it is recorded
/// here.
///
/// Kept in `UserDefaults` beside the sync cursor: a small set of ids, never queried,
/// so an `EVYDataStore` would be a container, a schema and a migration surface for no
/// gain.
enum EVYOwnershipLedger {
  private static let key = "ownedRecords"

  private struct Entry: Codable, Hashable {
    let service: String
    let resource: String
    let id: String
  }

  private static var entries: Set<Entry> {
    get {
      guard let data = UserDefaults.standard.data(forKey: key),
        let decoded = try? JSONDecoder().decode(Set<Entry>.self, from: data)
      else {
        return []
      }
      return decoded
    }
    set {
      guard let data = try? JSONEncoder().encode(newValue) else { return }
      UserDefaults.standard.set(data, forKey: key)
    }
  }

  /// Idempotent: a `Set` means recording the same record twice is a no-op.
  static func record(service: String, resource: String, id: String) {
    entries.insert(Entry(service: service, resource: resource, id: id))
  }

  static func recordedIds() -> [(service: String, resource: String, id: String)] {
    entries.map { ($0.service, $0.resource, $0.id) }
  }

  // used by tests
  static func reset() {
    UserDefaults.standard.removeObject(forKey: key)
  }
}

extension EVY {
  private struct OwnedServiceResourceKey: Hashable {
    let service: String
    let resource: String
  }

  /// Records that this device owns a record it just created. See `EVYOwnershipLedger`
  /// for why a created record has to be recorded rather than inferred from its
  /// visibility.
  static func recordOwnership(service: String, resource: String, id: String) {
    EVYOwnershipLedger.record(service: service, resource: resource, id: id)
  }

  /// One entry per (service, resource) this device owns records in, from three sources.
  ///
  /// - the **ledger**: records this device created. The only thing that can say "mine"
  ///   about a public record, which is what keeps a seller entitled to messages about
  ///   an item they listed.
  /// - the **private store**: records this device holds privately. A message that
  ///   arrives for you lands there, so it stays owned and its later updates keep
  ///   coming even when nothing else entitles you to it.
  /// - the **launch override**: ownership an account would confer, until auth lands.
  static func ownedServiceResources() -> [OwnedServiceResource] {
    var idsByKey: [OwnedServiceResourceKey: Set<String>] = [:]

    for record in EVYOwnershipLedger.recordedIds() {
      idsByKey[.init(service: record.service, resource: record.resource), default: []]
        .insert(record.id)
    }
    for row in (try? privateStore.getAll()) ?? []
    where isSyncedNamespace(row.namespace) {
      idsByKey[.init(service: row.namespace, resource: row.resource), default: []]
        .insert(row.id)
    }
    for declared in preownedServiceResources {
      idsByKey[.init(service: declared.service, resource: declared.resource), default: []]
        .formUnion(declared.ids)
    }

    // Sorted so an unchanged ownership set produces an identical request payload
    // between syncs.
    let owned =
      idsByKey
      .map {
        OwnedServiceResource(
          service: $0.key.service, resource: $0.key.resource, ids: $0.value.sorted())
      }
      .sorted { ($0.service, $0.resource) < ($1.service, $1.resource) }

    // The request schema requires uuids, and one bad id fails the whole sync - every
    // resource, not just messages. Fail here instead, where the source is visible.
    assert(
      owned.allSatisfy { $0.ids.allSatisfy(isEvyRecordId) },
      "ownedServiceResources must only contain record ids: \(owned)")

    return owned
  }

  /// Local singletons and scratch scopes share the private store but are not records
  /// the server knows, so they are not ownership candidates. Their id is
  /// `EVYNamespace.singletonId`, which is not a uuid.
  private static func isSyncedNamespace(_ namespace: String) -> Bool {
    namespace != EVYNamespace.local
      && namespace != EVYNamespace.cache
      && namespace != EVYNamespace.draft
  }

  /// Ownership this device holds without having created the record locally.
  ///
  /// Stands in for the account-derived ownership that arrives with real auth: today the
  /// only records a device can prove it owns are the ones it created, so seeded data
  /// belonging to "this user" has to be declared from outside. Read the same way as the
  /// `API_HOST` / `AUTH_TOKEN` overrides, and empty in a normal launch. Decoded once - the
  /// environment cannot change within a process.
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

  /// Stable fingerprint of the ownership this device did not earn by creating the record.
  ///
  /// The sync cursor means "you have seen everything up to here *for what you were entitled
  /// to*". Ownership earned at create time can never invalidate it - a message cannot
  /// address a record that did not exist yet - but declared ownership can: it makes records
  /// visible that may have changed long before the cursor. Sync compares this against the
  /// last synced value and starts over when it differs.
  static func declaredOwnershipFingerprint() -> String {
    preownedServiceResources
      .map { "\($0.service)/\($0.resource):\($0.ids.sorted().joined(separator: ","))" }
      .sorted()
      .joined(separator: ";")
  }
}
