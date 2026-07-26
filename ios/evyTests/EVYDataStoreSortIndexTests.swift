//
//  EVYDataStoreSortIndexTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYDataStoreSortIndexTests: XCTestCase {
  private var resourcesToDelete: [(namespace: String, resource: String)] = []

  override func setUp() async throws {
    try await super.setUp()
    try? EVY.publicStore.deleteAll(namespace: "test", resource: "items")
  }

  override func tearDown() async throws {
    try? EVY.publicStore.deleteAll(namespace: "test", resource: "items")
    for resource in resourcesToDelete {
      try? EVY.publicStore.deleteAll(namespace: resource.namespace, resource: resource.resource)
    }
    try await super.tearDown()
  }

  func testApplySyncedValuePreservesSortIndexForExistingItem() throws {
    let originalData = try JSONEncoder().encode(
      EVYJson.dictionary(["id": .string("item-1"), "title": .string("Original")]))
    try EVY.publicStore.create(
      namespace: "test", resource: "items", id: "item-1", value: originalData, sortIndex: 7)

    let updatedValue = EVYJson.dictionary(["id": .string("item-1"), "title": .string("Updated")])
    try EVY.publicStore.applySyncedValue(namespace: "test", resource: "items", value: updatedValue)

    let stored = try EVY.publicStore.get(namespace: "test", resource: "items", id: "item-1")
    XCTAssertEqual(stored.sortIndex, 7)
    XCTAssertEqual(
      try stored.decoded(), .dictionary(["id": .string("item-1"), "title": .string("Updated")]))
  }

  func testApplySyncedValueSingleNewItemAppendsAfterExistingItems() throws {
    try EVY.publicStore.create(
      namespace: "test", resource: "items", id: "item-1", value: makeItemData(id: "item-1"),
      sortIndex: 0)
    try EVY.publicStore.create(
      namespace: "test", resource: "items", id: "item-2", value: makeItemData(id: "item-2"),
      sortIndex: 5)

    let newValue = EVYJson.dictionary(["id": .string("item-3"), "title": .string("New")])
    try EVY.publicStore.applySyncedValue(namespace: "test", resource: "items", value: newValue)

    let stored = try EVY.publicStore.get(namespace: "test", resource: "items", id: "item-3")
    XCTAssertEqual(stored.sortIndex, 6)

    let all = try EVY.publicStore.getAll(namespace: "test", resource: "items")
    XCTAssertEqual(all.last?.id, "item-3")
  }

  func testApplySyncedValueSingleNewItemUsesZeroWhenCollectionIsEmpty() throws {
    let newValue = EVYJson.dictionary(["id": .string("item-1"), "title": .string("First")])
    try EVY.publicStore.applySyncedValue(namespace: "test", resource: "items", value: newValue)

    let stored = try EVY.publicStore.get(namespace: "test", resource: "items", id: "item-1")
    XCTAssertEqual(stored.sortIndex, 0)
  }

  func testCollectionResolvesFromExactResourceId() throws {
    let resourceId = UUID().uuidString
    resourcesToDelete.append((namespace: EVYNamespace.marketplace, resource: resourceId))

    try EVY.publicStore.applySyncedValue(
      namespace: EVYNamespace.marketplace,
      resource: resourceId,
      value: .array([
        .dictionary([
          "id": .string("item-1"),
          "title": .string("Visible item"),
        ])
      ])
    )

    XCTAssertEqual(
      try EVY.getDataFromText("{\(resourceId)}"),
      .array([
        .dictionary([
          "id": .string("item-1"),
          "title": .string("Visible item"),
        ])
      ])
    )
  }

  func testCollectionDoesNotResolveFromResourceName() throws {
    let resourceId = UUID().uuidString
    let resourceName =
      "evy_data_store_sort_index_test_\(UUID().uuidString.replacingOccurrences(of: "-", with: "_"))"
    resourcesToDelete.append((namespace: EVYNamespace.marketplace, resource: resourceId))

    try EVY.publicStore.applySyncedValue(
      namespace: EVYNamespace.marketplace,
      resource: resourceId,
      value: .array([
        .dictionary([
          "id": .string("item-1"),
          "title": .string("Visible item"),
        ])
      ])
    )

    XCTAssertThrowsError(try EVY.getDataFromText("{\(resourceName)}"))
  }

  /// Regression: the store's manually created ModelContext never autosaves, so
  /// without an explicit save() every write was lost when the process exited —
  /// while the sync cursor survived in UserDefaults, leaving relaunches with an
  /// empty store that incremental sync could never repopulate ("Failed to load
  /// flows"). A second store instance reading the same file only sees the row if
  /// the first instance actually flushed to disk.
  func testWritesSurviveIntoAFreshStoreInstance() throws {
    let storeName = "persistence-test-\(UUID().uuidString)"
    let writer = EVYDataStore(name: storeName)
    try writer.create(
      namespace: "test", resource: "items", id: "item-1",
      value: makeItemData(id: "item-1"))

    let reader = EVYDataStore(name: storeName)
    let row = try reader.get(namespace: "test", resource: "items", id: "item-1")
    XCTAssertEqual(row.id, "item-1")

    try writer.deleteAll(namespace: "test", resource: "items")
  }

  private func makeItemData(id: String) throws -> Data {
    try JSONEncoder().encode(EVYJson.dictionary(["id": .string(id)]))
  }
}
