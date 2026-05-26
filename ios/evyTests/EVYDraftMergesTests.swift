//
//  EVYCreateMergesDraftsTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYCreateMergesDraftsTests: XCTestCase {
  private let testDraftScope = "__test__:items"

  override func setUp() async throws {
    try await super.setUp()
    try? EVY.publicStore.deleteAll(namespace: "marketplace", resource: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = testDraftScope
  }

  override func tearDown() async throws {
    try? EVY.publicStore.deleteAll(namespace: "marketplace", resource: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    try await super.tearDown()
  }

  func testCreateMergesScalarTitleFromDraft() throws {
    EVY.ensureDraftExists(variableName: "title")
    try EVY.updateValue("User Title", at: "{title}")

    try EVY.create(namespace: "marketplace", resource: "items", draftScopeId: testDraftScope)

    let instances = try EVY.publicStore.getAll(namespace: "marketplace", resource: "items")
    XCTAssertEqual(instances.count, 1, "Expected one created item")

    let merged = try instances[0].decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["title"], .string("User Title"))
  }

  func testCreateMergesStructuredPriceFromDraft() throws {
    EVY.ensureDraftExists(variableName: "price")
    let newPrice = EVYJson.dictionary([
      "currency": .string("AUD"),
      "value": .decimal(99),
    ])
    let priceBinding = try EVY.draftStore.binding(fromParsedProps: "price")
    try EVY.cacheStore.update(
      namespace: EVYNamespace.draft,
      resource: priceBinding.scopeId,
      id: priceBinding.draftKey,
      value: try JSONEncoder().encode(newPrice)
    )
    EVY.draftStore.notifyUpdate(binding: priceBinding)

    try EVY.create(namespace: "marketplace", resource: "items", draftScopeId: testDraftScope)

    let instances = try EVY.publicStore.getAll(namespace: "marketplace", resource: "items")
    XCTAssertEqual(instances.count, 1, "Expected one created item")

    let merged = try instances[0].decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    guard case .dictionary(let mergedPrice)? = dict["price"] else {
      XCTFail("expected price dictionary")
      return
    }
    XCTAssertEqual(mergedPrice["currency"], .string("AUD"))

    let value = mergedPrice["value"]
    XCTAssertTrue(
      value == .decimal(99) || value == .int(99),
      "expected price value 99, got \(String(describing: value))"
    )
  }

  func testCreateAppendsNewItemWithHighestSortIndex() throws {
    let seed1Data = try JSONEncoder().encode(EVYJson.dictionary(["id": .string("seed-1")]))
    let seed2Data = try JSONEncoder().encode(EVYJson.dictionary(["id": .string("seed-2")]))
    try EVY.publicStore.create(namespace: "marketplace", resource: "items", id: "seed-1", value: seed1Data, sortIndex: 0)
    try EVY.publicStore.create(namespace: "marketplace", resource: "items", id: "seed-2", value: seed2Data, sortIndex: 1)

    EVY.ensureDraftExists(variableName: "title")
    try EVY.updateValue("New Item", at: "{title}")
    try EVY.create(namespace: "marketplace", resource: "items", draftScopeId: testDraftScope)

    let instances = try EVY.publicStore.getAll(namespace: "marketplace", resource: "items")
    XCTAssertEqual(instances.count, 3)
    let newItem = try XCTUnwrap(instances.first(where: { $0.id != "seed-1" && $0.id != "seed-2" }))
    XCTAssertEqual(newItem.sortIndex, 2)
    XCTAssertEqual(instances.last?.id, newItem.id)
  }
}
