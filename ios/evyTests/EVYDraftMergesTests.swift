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
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.marketplace, resource: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = testDraftScope
  }

  override func tearDown() async throws {
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.marketplace, resource: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    try await super.tearDown()
  }

  func testCreateMergesScalarTitleFromDraft() throws {
    EVY.ensureDraftExists(variableName: "title", scopeId: testDraftScope)
    try EVY.updateValue("User Title", destination: "{title}", scopeId: testDraftScope)

    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items")

    let instances = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: "items")
    XCTAssertEqual(instances.count, 1, "Expected one created item")

    let merged = try instances[0].decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["title"], .string("User Title"))

    XCTAssertEqual(
      try EVY.draftStore.drafts(forScopeId: testDraftScope).count, 0,
      "Flow submission should clean up the scope's drafts")
  }

  func testCreateMergesStructuredPriceFromDraft() throws {
    EVY.ensureDraftExists(variableName: "price", scopeId: testDraftScope)
    let newPrice = EVYJson.dictionary([
      "currency": .string("AUD"),
      "value": .decimal(99),
    ])
    let priceBinding = try EVY.draftStore.binding(fromParsedProps: "price", scopeId: testDraftScope)
    try EVY.cacheStore.update(
      namespace: EVYNamespace.draft,
      resource: priceBinding.scopeId,
      id: priceBinding.draftKey,
      value: try JSONEncoder().encode(newPrice)
    )
    EVY.draftStore.notifyUpdate(binding: priceBinding)

    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items")

    let instances = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: "items")
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
    try EVY.publicStore.create(
      namespace: EVYNamespace.marketplace, resource: "items", id: "seed-1", value: seed1Data,
      sortIndex: 0)
    try EVY.publicStore.create(
      namespace: EVYNamespace.marketplace, resource: "items", id: "seed-2", value: seed2Data,
      sortIndex: 1)

    EVY.ensureDraftExists(variableName: "title", scopeId: testDraftScope)
    try EVY.updateValue("New Item", destination: "{title}", scopeId: testDraftScope)
    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items")

    let instances = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: "items")
    XCTAssertEqual(instances.count, 3)
    let newItem = try XCTUnwrap(instances.first(where: { $0.id != "seed-1" && $0.id != "seed-2" }))
    XCTAssertEqual(newItem.sortIndex, 2)
    XCTAssertEqual(instances.last?.id, newItem.id)
  }

  func testCreateMergesConditionIdSellingReasonIdAndNestedDimensions() throws {
    let conditionId = UUID().uuidString
    let sellingReasonId = UUID().uuidString

    EVY.ensureDraftExists(variableName: "condition_id", scopeId: testDraftScope)
    try EVY.updateValue(conditionId, destination: "{condition_id}", scopeId: testDraftScope)

    EVY.ensureDraftExists(variableName: "selling_reason_id", scopeId: testDraftScope)
    try EVY.updateValue(
      sellingReasonId, destination: "{selling_reason_id}", scopeId: testDraftScope)

    EVY.ensureDraftExists(variableName: "dimensions.width", scopeId: testDraftScope)
    try EVY.updateValue("500", destination: "{dimensions.width}", scopeId: testDraftScope)

    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items")

    let instances = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: "items")
    XCTAssertEqual(instances.count, 1, "Expected one created item")

    let merged = try instances[0].decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }

    XCTAssertEqual(
      dict["condition_id"], .string(conditionId),
      "condition_id should be a top-level id string")
    XCTAssertEqual(
      dict["selling_reason_id"], .string(sellingReasonId),
      "selling_reason_id should be a top-level id string")

    guard case .dictionary(let dimensions)? = dict["dimensions"] else {
      XCTFail("expected nested dimensions dictionary")
      return
    }
    XCTAssertEqual(
      dimensions["width"], .string("500"),
      "dimensions.width should be nested under dimensions")
  }

  func testCreateWithDataPersistsPayloadWithoutTouchingDrafts() throws {
    EVY.ensureDraftExists(variableName: "title", scopeId: testDraftScope)
    try EVY.updateValue("Draft Title", destination: "{title}", scopeId: testDraftScope)

    let payload: [String: EVYJson] = [
      "title": .string("Datum Title"),
      "type": .string("pickup"),
    ]
    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items", data: payload)

    let instances = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: "items")
    XCTAssertEqual(instances.count, 1, "Expected one created item")

    let created = try instances[0].decoded()
    guard case .dictionary(let dict) = created else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["title"], .string("Datum Title"))
    XCTAssertEqual(dict["type"], .string("pickup"))

    XCTAssertEqual(
      try EVY.draftStore.drafts(forScopeId: testDraftScope).count, 1,
      "Datum create should not merge or clean up drafts in the active scope")
  }

  func testCreateFallsBackToMergingActiveScopeWhenNotAFlowSubmissionScope() throws {
    let browseScope = "flow-1:browse"
    EVY.draftStore.activeScopeId = browseScope
    defer {
      EVY.draftStore.deleteDrafts(scopeId: browseScope)
      EVY.draftStore.activeScopeId = testDraftScope
    }

    EVY.ensureDraftExists(variableName: "title", scopeId: browseScope)
    try EVY.updateValue("Stray Title", destination: "{title}", scopeId: browseScope)

    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items")

    let instances = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: "items")
    XCTAssertEqual(instances.count, 1, "Expected one created item")

    let created = try instances[0].decoded()
    guard case .dictionary(let dict) = created else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["title"], .string("Stray Title"))

    XCTAssertEqual(
      try EVY.draftStore.drafts(forScopeId: browseScope).count, 1,
      "Fallback create should not clean up drafts outside a flow-submission scope")
  }
}
