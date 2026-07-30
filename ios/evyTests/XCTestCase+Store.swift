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

    let parts = key.split(separator: ":", maxSplits: 2).map(String.init)
    if parts.count == 2 {
      let namespace = parts[0]
      let resource = parts[1]
      try EVY.publicStore.applySyncedValue(namespace: namespace, resource: resource, value: value)
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
