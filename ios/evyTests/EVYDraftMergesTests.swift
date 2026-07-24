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
    installHermeticMutationSync()
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.marketplace, resource: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = testDraftScope
  }

  override func tearDown() async throws {
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.marketplace, resource: "items")
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    resetHermeticMutationSync()
    try await super.tearDown()
  }

  func testCreateMergesScalarTitleFromDraft() throws {
    EVY.ensureDraftExists(variableName: "items.title", scopeId: testDraftScope)
    try EVY.updateValue("User Title", destination: "{items.title}", scopeId: testDraftScope)

    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items", isSubmission: true)

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
    EVY.ensureDraftExists(variableName: "items.price", scopeId: testDraftScope)
    let newPrice = EVYJson.dictionary([
      "currency": .string("AUD"),
      "value": .decimal(99),
    ])
    let priceBinding = try EVY.draftStore.binding(
      fromParsedProps: "items.price", scopeId: testDraftScope)
    try EVY.cacheStore.update(
      namespace: EVYNamespace.draft,
      resource: priceBinding.scopeId,
      id: priceBinding.draftKey,
      value: try JSONEncoder().encode(newPrice)
    )
    EVY.draftStore.notifyUpdate(binding: priceBinding)

    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items", isSubmission: true)

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

    EVY.ensureDraftExists(variableName: "items.title", scopeId: testDraftScope)
    try EVY.updateValue("New Item", destination: "{items.title}", scopeId: testDraftScope)
    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items", isSubmission: true)

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

    EVY.ensureDraftExists(variableName: "items.condition_id", scopeId: testDraftScope)
    try EVY.updateValue(
      conditionId, destination: "{items.condition_id}", scopeId: testDraftScope)

    EVY.ensureDraftExists(variableName: "items.selling_reason_id", scopeId: testDraftScope)
    try EVY.updateValue(
      sellingReasonId, destination: "{items.selling_reason_id}", scopeId: testDraftScope)

    EVY.ensureDraftExists(variableName: "items.dimensions.width", scopeId: testDraftScope)
    try EVY.updateValue(
      "500", destination: "{items.dimensions.width}", scopeId: testDraftScope)

    try EVY.create(namespace: EVYNamespace.marketplace, resource: "items", isSubmission: true)

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
    EVY.ensureDraftExists(variableName: "items.title", scopeId: testDraftScope)
    try EVY.updateValue("Draft Title", destination: "{items.title}", scopeId: testDraftScope)

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

  func testCreateMergesAddressIdAndKeepsItemFieldsFlatWhenScopeIsItems() throws {
    let flowId = "create-flow"
    let itemsResource = uniqueKey("items")
    let scopeId = EVYDraft.createMergeScopeId(flowId: flowId, entityKey: itemsResource)
    let linkedAddressId = UUID().uuidString
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: EVYNamespace.marketplace, resource: itemsResource)
      EVY.draftStore.deleteDrafts(scopeId: scopeId)
      EVY.draftStore.activeScopeId = testDraftScope
    }

    try EVY.writeRawStringValue("Listed with address", to: "{\(itemsResource).title}")
    try EVY.writeRawStringValue(
      linkedAddressId,
      to: "{\(itemsResource).transfer_options.pickup.address_id}"
    )
    try EVY.writeRawValue(
      .dictionary([
        "street": .string("25 Rosebery Avenue"),
        "city": .string("Rosebery"),
      ]),
      to: "{pickup_address}"
    )

    _ = try EVY.create(
      namespace: EVYNamespace.marketplace, resource: itemsResource, isSubmission: true)

    let items = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: itemsResource)
    XCTAssertEqual(items.count, 1)
    let merged = try items[0].decoded()
    guard case .dictionary(let dict) = merged else {
      return XCTFail("expected item dictionary")
    }
    XCTAssertEqual(dict["title"], .string("Listed with address"))
    XCTAssertNil(
      dict[itemsResource],
      "item fields must stay flat; nested resource-id root means draft scope was stolen")
    XCTAssertNil(
      dict["pickup_address"],
      "page-local pickup_address draft must not be stored on the item; only address_id links")
    guard case .dictionary(let transfer)? = dict["transfer_options"],
      case .dictionary(let pickup)? = transfer["pickup"]
    else {
      return XCTFail("expected transfer_options.pickup on created item: \(dict)")
    }
    XCTAssertEqual(pickup["address_id"], .string(linkedAddressId))
  }

  func testNestedAddressIdWriteGoesToCreateDraftNotExistingItemRow() throws {
    let flowId = "create-flow"
    let itemsResource = uniqueKey("items")
    let scopeId = EVYDraft.createMergeScopeId(flowId: flowId, entityKey: itemsResource)
    let existingItemId = UUID().uuidString
    let linkedAddressId = UUID().uuidString
    let existingPayload = try JSONEncoder().encode(
      EVYJson.dictionary([
        "id": .string(existingItemId),
        "title": .string("Already listed"),
      ]))
    try EVY.publicStore.create(
      namespace: EVYNamespace.marketplace,
      resource: itemsResource,
      id: existingItemId,
      value: existingPayload
    )
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: EVYNamespace.marketplace, resource: itemsResource)
      EVY.draftStore.deleteDrafts(scopeId: scopeId)
      EVY.draftStore.activeScopeId = testDraftScope
    }

    try EVY.writeRawStringValue("Listed with address", to: "{\(itemsResource).title}")
    try EVY.writeRawStringValue(
      linkedAddressId,
      to: "{\(itemsResource).transfer_options.pickup.address_id}"
    )

    let existingAfterWrite = try EVY.publicStore.get(
      namespace: EVYNamespace.marketplace, resource: itemsResource, id: existingItemId)
    let existingDecoded = try existingAfterWrite.decoded()
    guard case .dictionary(let existingDict) = existingDecoded else {
      return XCTFail("expected existing item dictionary")
    }
    XCTAssertNil(
      existingDict["transfer_options"],
      "address_id must not patch the first existing row of the items resource")

    _ = try EVY.create(
      namespace: EVYNamespace.marketplace, resource: itemsResource, isSubmission: true)

    let items = try EVY.publicStore.getAll(
      namespace: EVYNamespace.marketplace, resource: itemsResource)
    XCTAssertEqual(items.count, 2)
    let created = try XCTUnwrap(
      items.first { row in
        guard case .dictionary(let dict) = try? row.decoded() else { return false }
        return dict["title"] == .string("Listed with address")
      })
    guard case .dictionary(let dict) = try created.decoded() else {
      return XCTFail("expected created item dictionary")
    }
    guard case .dictionary(let transfer)? = dict["transfer_options"],
      case .dictionary(let pickup)? = transfer["pickup"]
    else {
      return XCTFail("expected transfer_options.pickup on created item: \(dict)")
    }
    XCTAssertEqual(pickup["address_id"], .string(linkedAddressId))
  }

  func testSubmitCreateThrowsWhenActiveScopeIsNotCreateScopeForResource() throws {
    let browseScope = "flow-1:browse"
    EVY.draftStore.activeScopeId = browseScope
    defer {
      EVY.draftStore.deleteDrafts(scopeId: browseScope)
      EVY.draftStore.activeScopeId = testDraftScope
    }

    EVY.ensureDraftExists(variableName: "title", scopeId: browseScope)
    try EVY.updateValue("Stray Title", destination: "{title}", scopeId: browseScope)

    XCTAssertThrowsError(
      try EVY.create(
        namespace: EVYNamespace.marketplace, resource: "items", isSubmission: true)
    ) { error in
      guard let evyError = error as? EVYError else {
        return XCTFail("expected EVYError, got \(error)")
      }
      if case .invalidData(let context) = evyError {
        XCTAssertTrue(context.contains("active create scope"))
      } else {
        XCTFail("expected invalidData, got \(evyError)")
      }
    }

    XCTAssertEqual(
      try EVY.draftStore.drafts(forScopeId: browseScope).count, 1,
      "Failed submit create should not clean up browse-scope drafts")
  }
}
