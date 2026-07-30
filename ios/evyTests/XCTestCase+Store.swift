//
//  XCTestCase+Store.swift
//  evyTests
//

import XCTest

@testable import evy

extension XCTestCase {
  @MainActor
  func seedLocalBinding(key: String, value: EVYJson) throws {
    let encodedValue = try JSONEncoder().encode(value)

    if let namespace = try? EVYResourceRef.serviceOf(key) {
      // Re-seeding the same dotted ref within one test leaves upserted stragglers;
      // applySyncedValue upserts per item and never clears stale rows.
      if case .array = value {
        try? EVY.publicStore.deleteAll(namespace: namespace, resource: key)
      }
      try EVY.publicStore.applySyncedValue(namespace: namespace, resource: key, value: value)
      return
    }

    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.local, resource: key)
    try EVY.publicStore.create(
      namespace: EVYNamespace.local,
      resource: key,
      id: EVYNamespace.singletonId,
      value: encodedValue
    )
  }
}
