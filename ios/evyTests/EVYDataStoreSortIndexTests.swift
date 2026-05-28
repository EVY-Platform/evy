//
//  EVYDataStoreSortIndexTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYDataStoreSortIndexTests: XCTestCase {
  override func setUp() async throws {
    try await super.setUp()
    try? EVY.publicStore.deleteAll(namespace: "test", resource: "items")
  }

  override func tearDown() async throws {
    try? EVY.publicStore.deleteAll(namespace: "test", resource: "items")
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

  private func makeItemData(id: String) throws -> Data {
    try JSONEncoder().encode(EVYJson.dictionary(["id": .string(id)]))
  }
}
