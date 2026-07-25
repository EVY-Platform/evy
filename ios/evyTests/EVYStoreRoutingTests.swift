//
//  EVYStoreRoutingTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYStoreRoutingTests: XCTestCase {
  override func setUpWithError() throws {
    // Without this the create/update cases below fire real RPCs at localhost:8000.
    installHermeticMutationSync()
  }

  override func tearDownWithError() throws {
    resetHermeticMutationSync()
    try? EVY.publicStore.wipeAll()
    try? EVY.privateStore.wipeAll()
  }

  func testApplySyncedValueRoutesByVisibility() throws {
    let publicId = UUID().uuidString
    let privateId = UUID().uuidString
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.addresses.rawValue,
      value: .array([
        .dictionary(["id": .string(publicId), "visibility": .string("public")]),
        .dictionary(["id": .string(privateId), "visibility": .string("private")]),
      ])
    )

    XCTAssertNotNil(
      try? EVY.publicStore.get(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.addresses.rawValue,
        id: publicId))
    XCTAssertNotNil(
      try? EVY.privateStore.get(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.addresses.rawValue,
        id: privateId))
  }

  func testApplySyncedValueMovesRecordWhenVisibilityChanges() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.addresses.rawValue
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("public")])
    )
    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("private")])
    )
    XCTAssertNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
    XCTAssertNotNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  func testBindingReadsResolvePrivateStoreRecords() throws {
    let recordId = UUID().uuidString
    let street = "28 Rothschild Avenue"
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.addresses.rawValue,
      value: .array([
        .dictionary([
          "id": .string(recordId),
          "street": .string(street),
          "visibility": .string("private"),
        ])
      ])
    )

    let collection = try _getDataFromText("{\(EVYCoreResource.addresses.rawValue)}")
    guard case .array(let items) = collection else {
      return XCTFail("Expected address collection")
    }
    XCTAssertEqual(items.count, 1)

    let first = try _getDataFromText(
      "{findFirst(\(EVYCoreResource.addresses.rawValue), id == \(recordId)).street}")
    XCTAssertEqual(first, .string(street))
  }

  func testUpdatePatchesPrivateStoreRecord() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.messages.rawValue
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary([
        "id": .string(recordId),
        "status": .string("pending"),
        "visibility": .string("private"),
      ])
    )

    try EVY.update(
      namespace: EVYNamespace.evy,
      resource: resource,
      matching: ["id": .string(recordId), "status": .string("pending")],
      changes: ["status": .string("accepted")]
    )

    let row = try EVY.privateStore.get(
      namespace: EVYNamespace.evy, resource: resource, id: recordId)
    let decoded = try row.decoded()
    guard case .dictionary(let values) = decoded else {
      return XCTFail("Expected dictionary payload")
    }
    XCTAssertEqual(values["status"], .string("accepted"))
  }

  func testCreateWithGeneratedIdRoutesByVisibility() throws {
    let namespace = EVYNamespace.evy
    let resource = "routing-create-test"
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }
    defer { try? EVY.privateStore.deleteAll(namespace: namespace, resource: resource) }

    _ = try EVY.create(
      namespace: namespace,
      resource: resource,
      data: ["visibility": .string("private")]
    )
    let privateRows = try EVY.privateStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(privateRows.count, 1)

    _ = try EVY.create(namespace: namespace, resource: resource, data: [:])
    let publicRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(publicRows.count, 1)
    let publicDecoded = try publicRows[0].decoded()
    guard case .dictionary(let values) = publicDecoded else {
      return XCTFail("Expected dictionary payload")
    }
    XCTAssertEqual(values["visibility"], .string("public"))
  }

  func testRemoveSyncedValueDeletesFromPublicStore() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.messages.rawValue
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("public")])
    )
    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))

    try EVY.removeSyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId)])
    )

    XCTAssertNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  func testRemoveSyncedValueDeletesFromPrivateStore() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.addresses.rawValue
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("private")])
    )
    XCTAssertNotNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))

    // The delete payload need not carry visibility, so both stores are cleared.
    try EVY.removeSyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId)])
    )

    XCTAssertNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  func testRemoveSyncedValueHandlesArraysAndMissingRecords() throws {
    let presentId = UUID().uuidString
    let absentId = UUID().uuidString
    let resource = EVYCoreResource.messages.rawValue
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(presentId), "visibility": .string("public")])
    )

    try EVY.removeSyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary(["id": .string(presentId)]),
        .dictionary(["id": .string(absentId)]),
      ])
    )

    XCTAssertNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: presentId))
  }

  func testRecordsWithoutVisibilityDefaultToPublicStore() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.flows.rawValue
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId)])
    )
    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
    XCTAssertNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }
}
