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
