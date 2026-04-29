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
    try? EVY.publicStore.delete(key: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = testDraftScope
  }

  override func tearDown() async throws {
    try? EVY.publicStore.delete(key: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    try await super.tearDown()
  }

  func testCreateMergesScalarTitleFromDraft() throws {
    let seed: [String: EVYJson] = [
      "id": .string("00000000-0000-0000-0000-000000000001"),
      "title": .string("Seed Title"),
    ]
    try EVY.publicStore.create(
      key: "items", data: try JSONEncoder().encode(EVYJson.dictionary(seed)))
    let row = try EVY.publicStore.get(key: "items")

    EVY.ensureDraftExists(variableName: "title")
    try EVY.updateValue("User Title", at: "{title}")

    try EVY.create(key: "items", draftScopeId: testDraftScope)

    let merged = try row.decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["title"], .string("User Title"))
  }

  func testCreateMergesStructuredPriceFromDraft() throws {
    let seed: [String: EVYJson] = [
      "id": .string("00000000-0000-0000-0000-000000000001"),
      "title": .string("X"),
      "price": .dictionary([
        "currency": .string("AUD"),
        "value": .decimal(250),
      ]),
    ]
    try EVY.publicStore.create(
      key: "items", data: try JSONEncoder().encode(EVYJson.dictionary(seed)))
    let row = try EVY.publicStore.get(key: "items")

    EVY.ensureDraftExists(variableName: "price")
    let newPrice = EVYJson.dictionary([
      "currency": .string("AUD"),
      "value": .decimal(99),
    ])
    let priceBinding = try EVY.draftStore.binding(fromParsedProps: "price")
    try EVY.draftStore.upsert(binding: priceBinding, data: try JSONEncoder().encode(newPrice))

    try EVY.create(key: "items", draftScopeId: testDraftScope)

    let merged = try row.decoded()
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

  func testCreateSkipsEmptyBootstrapDraftSoSeedTitleRemains() throws {
    let seed: [String: EVYJson] = [
      "id": .string("00000000-0000-0000-0000-000000000001"),
      "title": .string("Seed Title"),
    ]
    try EVY.publicStore.create(
      key: "items", data: try JSONEncoder().encode(EVYJson.dictionary(seed)))
    let row = try EVY.publicStore.get(key: "items")

    EVY.ensureDraftExists(variableName: "title")

    try EVY.create(key: "items", draftScopeId: testDraftScope)

    let merged = try row.decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["title"], .string("Seed Title"))
  }

  func testCreateMergesWidthDraftIntoTopLevelField() throws {
    let seed: [String: EVYJson] = [
      "id": .string("00000000-0000-0000-0000-000000000001"),
      "title": .string("T"),
      "dimensions": .dictionary([
        "width": .int(500),
        "height": .int(1600),
      ]),
    ]
    try EVY.publicStore.create(
      key: "items", data: try JSONEncoder().encode(EVYJson.dictionary(seed)))
    let row = try EVY.publicStore.get(key: "items")

    EVY.ensureDraftExists(variableName: "width")
    try EVY.updateValue("50", at: "{width}")

    try EVY.create(key: "items", draftScopeId: testDraftScope)

    let merged = try row.decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["width"], .string("50"))
  }

  func testCreateAddsWidthFieldFromDraftWhenMissingFromSeed() throws {
    let seed: [String: EVYJson] = [
      "id": .string("00000000-0000-0000-0000-000000000001"),
      "title": .string("T"),
    ]
    try EVY.publicStore.create(
      key: "items", data: try JSONEncoder().encode(EVYJson.dictionary(seed)))
    let row = try EVY.publicStore.get(key: "items")

    EVY.ensureDraftExists(variableName: "width")
    try EVY.updateValue("50", at: "{width}")

    try EVY.create(key: "items", draftScopeId: testDraftScope)

    let merged = try row.decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["width"], .string("50"))
  }

  func testCreateMergesExplicitNestedPathFromDraft() throws {
    let seed: [String: EVYJson] = [
      "id": .string("00000000-0000-0000-0000-000000000001"),
      "title": .string("T"),
      "dimensions": .dictionary([
        "width": .int(1),
        "height": .int(2),
      ]),
    ]
    try EVY.publicStore.create(
      key: "items", data: try JSONEncoder().encode(EVYJson.dictionary(seed)))
    let row = try EVY.publicStore.get(key: "items")

    let binding = try EVYDraft.binding(
      parsedProps: "dimensions.width",
      scopeId: testDraftScope
    )
    try EVY.draftStore.upsert(
      binding: binding,
      data: try JSONEncoder().encode(EVYJson.string("99"))
    )

    try EVY.create(key: "items", draftScopeId: testDraftScope)

    let merged = try row.decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    guard case .dictionary(let dimensions)? = dict["dimensions"] else {
      XCTFail("expected dimensions dictionary")
      return
    }
    XCTAssertEqual(dimensions["width"], .string("99"))
  }

  func testCreateMergesOnlyDraftsForRequestedScope() throws {
    let seed: [String: EVYJson] = [
      "id": .string("00000000-0000-0000-0000-000000000001"),
      "title": .string("Seed"),
    ]
    try EVY.publicStore.create(
      key: "items", data: try JSONEncoder().encode(EVYJson.dictionary(seed)))
    let row = try EVY.publicStore.get(key: "items")

    let scopeA = "flow-a:items"
    let scopeB = "flow-b:items"

    let titleA = try EVYDraft.binding(parsedProps: "title", scopeId: scopeA)
    try EVY.draftStore.upsert(
      binding: titleA,
      data: try JSONEncoder().encode(EVYJson.string("From A"))
    )
    let titleB = try EVYDraft.binding(parsedProps: "title", scopeId: scopeB)
    try EVY.draftStore.upsert(
      binding: titleB,
      data: try JSONEncoder().encode(EVYJson.string("From B"))
    )

    try EVY.create(key: "items", draftScopeId: scopeA)

    let merged = try row.decoded()
    guard case .dictionary(let dict) = merged else {
      XCTFail("expected dictionary")
      return
    }
    XCTAssertEqual(dict["title"], .string("From A"))
  }
}
