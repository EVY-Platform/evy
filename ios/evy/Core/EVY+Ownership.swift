//
//  EVY+Ownership.swift
//  evy
//

import Foundation

extension EVY {
  private struct OwnedServiceResourceKey: Hashable {
    let service: String
    let resource: String
  }

  /// Records that this device owns a record it just created.
  ///
  /// The ledger is what sync sends as `ownedServiceResources`: it is how the server knows
  /// which messages to return, both the ones this device created and the ones addressed to
  /// records it owns. Ownership is only ever established here, at create time - holding a
  /// synced row is not owning it.
  ///
  /// Kept in its own store rather than a namespace inside `privateStore` because
  /// `EVYDataStore.namespace(forSyncedResource:)` resolves a bare binding key like `{items}`
  /// by scanning every non-local namespace for a matching resource name, so a ledger keyed
  /// by resource name would shadow real data.
  static func recordOwnership(service: String, resource: String, id: String) {
    // Best effort: failing to record ownership costs this record its messages, which is
    // not worth failing the create the user just made.
    try? ownedStore.upsert(
      namespace: service,
      resource: resource,
      id: id,
      value: Data("{}".utf8)
    )
  }

  /// One entry per (service, resource) this device owns records in.
  static func ownedServiceResources() -> [OwnedServiceResource] {
    var idsByKey: [OwnedServiceResourceKey: Set<String>] = [:]

    for row in (try? ownedStore.getAll()) ?? [] {
      idsByKey[.init(service: row.namespace, resource: row.resource), default: []]
        .insert(row.id)
    }
    for declared in preownedServiceResources {
      idsByKey[.init(service: declared.service, resource: declared.resource), default: []]
        .formUnion(declared.ids)
    }

    // Sorted so an unchanged ledger produces an identical request payload between syncs.
    return
      idsByKey
      .map {
        OwnedServiceResource(
          service: $0.key.service, resource: $0.key.resource, ids: $0.value.sorted())
      }
      .sorted { ($0.service, $0.resource) < ($1.service, $1.resource) }
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
