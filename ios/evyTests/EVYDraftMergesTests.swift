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
}
