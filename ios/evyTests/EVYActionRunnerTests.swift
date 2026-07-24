//
//  EVYActionRunnerTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYActionRunnerTests: XCTestCase {
  override func setUp() async throws {
    try await super.setUp()
    installHermeticMutationSync()
  }

  override func tearDown() async throws {
    resetHermeticMutationSync()
    try await super.tearDown()
  }

  private func assertSelectValue(
    _ received: EVYRowActionOperation?,
    equals expected: EVYJson,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    guard case .select(let value) = received else {
      XCTFail("Expected select, got \(String(describing: received))", file: file, line: line)
      return
    }
    XCTAssertEqual(value, expected, file: file, line: line)
  }

  private func assertRowPhotoOperationDispatchesAndContinues(
    action: String,
    expected: (EVYRowActionOperation) -> Bool
  ) {
    var received: EVYRowActionOperation?
    var receivedOps: [ActionOperation] = []
    EVYActionRunner.run(
      actions: [rowAction(true: action), rowAction(true: "{close()}")],
      rowOperation: { received = $0 }
    ) { receivedOps.append($0) }
    guard let received, expected(received) else {
      XCTFail("Unexpected row operation \(String(describing: received))")
      return
    }
    XCTAssertEqual(receivedOps, [.close])
  }

  func testCloseAction() {
    var received: ActionOperation?
    let action = rowAction(true: "{close()}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertEqual(received, .close)
  }

  func testBareCloseActionIsInert() {
    var received: ActionOperation?
    let action = rowAction(true: "close")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertNil(received)
  }

  func testUnwrappedCloseFunctionIsInert() {
    var received: ActionOperation?
    let action = rowAction(true: "close()")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertNil(received)
  }

  func testCreateActionPersistsFlowSubmissionAndEmitsNothing() throws {
    let namespace = EVYNamespace.marketplace
    let resource = MarketplaceTestFixture.itemsResourceId
    let scopeId = "__test__:\(resource)"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    EVY.ensureDraftExists(variableName: "\(resource).title", scopeId: scopeId)
    try EVY.updateValue(
      "Flow Submitted Title", destination: "{\(resource).title}", scopeId: scopeId)

    var received: ActionOperation?
    let action = rowAction(true: "{create(\(namespace),\(resource), submit)}")
    EVYActionRunner.run(actions: [action]) { received = $0 }

    XCTAssertNil(received)
    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected merged create payload dictionary")
    }
    XCTAssertEqual(values["title"], .string("Flow Submitted Title"))
    XCTAssertEqual(
      try EVY.draftStore.drafts(forScopeId: scopeId).count, 0,
      "Flow submission should clean up the scope's drafts")
  }

  func testCreateThenCloseRunsSequentially() throws {
    let namespace = EVYNamespace.marketplace
    let resource = MarketplaceTestFixture.itemsResourceId
    let scopeId = "__test__:\(resource)"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    EVY.ensureDraftExists(variableName: "title", scopeId: scopeId)
    try EVY.updateValue("Chained Title", destination: "{title}", scopeId: scopeId)

    var receivedOperations: [ActionOperation] = []
    let createAction = rowAction(true: "{create(\(namespace),\(resource), submit)}")
    let closeAction = rowAction(true: "{close()}")
    EVYActionRunner.run(actions: [createAction, closeAction]) { receivedOperations.append($0) }

    XCTAssertEqual(receivedOperations, [.close])
    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(createdRows.count, 1)
  }

  func testChainHaltsWhenActionThrows() {
    let throwingAction = rowAction(true: "{create(onlyNamespace)}")
    let closeAction = rowAction(true: "{close()}")
    var received: ActionOperation?
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [throwingAction, closeAction]) { received = $0 }
    }
    XCTAssertFalse(errors.isEmpty, "create with one arg should post an error")
    XCTAssertNil(received, "close should not run once an earlier action throws")
  }

  func testCreateActionParserParsesInlineData() {
    let action = EVYActionParser.createAction(
      from:
        "{create(ns,res,{fk: abc.id, archivedAt: null, data: {type: pickup, time: selected_pickup_timeslot}})}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(
      action?.data,
      .literal([
        "fk": "abc.id",
        "archivedAt": "null",
        "data": "{type: pickup, time: selected_pickup_timeslot}",
      ])
    )
  }

  func testCreateActionParserRejectsTwoArgumentCreate() {
    XCTAssertNil(EVYActionParser.createAction(from: "{create(ns,res)}"))
  }

  func testCreateActionParserParsesSubmitMarker() {
    let action = EVYActionParser.createAction(from: "{create(ns,res,submit)}")

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(action?.isSubmission, true)
    XCTAssertNil(action?.data)
    XCTAssertNil(action?.idDestination)
  }

  func testCreateActionParserRejectsSubmitWithExtraArgs() {
    XCTAssertNil(
      EVYActionParser.createAction(
        from: "{create(ns,res,submit,{pickup_address.id})}"))
  }

  func testCreateActionParserParsesIdDestination() {
    let action = EVYActionParser.createAction(
      from: "{create(ns,res,{street: Main},item.transfer_options.pickup.address_id)}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(action?.data, .literal(["street": "Main"]))
    XCTAssertEqual(action?.idDestination, "item.transfer_options.pickup.address_id")
  }

  func testCreateActionParserParsesDataPath() {
    let action = EVYActionParser.createAction(
      from: "{create(ns,res,pickup_address,{pickup_address.id})}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(action?.data, .path("pickup_address"))
    XCTAssertEqual(action?.idDestination, "{pickup_address.id}")
  }

  func testCreateActionParserRejectsEmptyDataPath() {
    XCTAssertNil(EVYActionParser.createAction(from: "{create(ns,res, ,{pickup_address.id})}"))
  }

  func testUpdateActionParserParsesChangesPath() {
    let action = EVYActionParser.updateAction(
      from: "{update(ns,res,{id: abc},pickup_address)}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(action?.filter, ["id": "abc"])
    XCTAssertEqual(action?.changes, .path("pickup_address"))
  }

  func testCreateActionParserRejectsMalformedInlineData() {
    XCTAssertNil(EVYActionParser.createAction(from: "{create(ns,res,{type: pickup, fk})}"))
  }

  func testCreateWithIdDestinationWritesGeneratedId() throws {
    let namespace = UUID().uuidString
    let resource = "addresses"
    let entityId = UUID().uuidString
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: UUID().uuidString)
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      try? EVY.publicStore.delete(
        namespace: EVYNamespace.local, resource: entityId, id: EVYNamespace.singletonId)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    try EVY.publicStore.create(
      namespace: EVYNamespace.local,
      resource: entityId,
      id: EVYNamespace.singletonId,
      value: #"{"transfer_options":{"pickup":{}}}"#.data(using: .utf8)!
    )

    let createAction = rowAction(
      true:
        "{create(\(namespace),\(resource),{street: Rothschild Avenue},{\(entityId).transfer_options.pickup.address_id})}"
    )
    var errors: [Error] = []
    let observer = NotificationCenter.default.addObserver(
      forName: .evyErrorOccurred, object: nil, queue: nil
    ) { note in
      if let error = note.object as? Error {
        errors.append(error)
      }
    }
    defer { NotificationCenter.default.removeObserver(observer) }

    EVYActionRunner.run(actions: [createAction]) { _ in }

    XCTAssertTrue(errors.isEmpty, "create with id destination should not error: \(errors)")
    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(createdRows.count, 1)
    let created = try createdRows[0].decoded()
    guard case .dictionary(let record) = created,
      case .string(let createdId) = record["id"]
    else {
      return XCTFail("expected created address dictionary with id")
    }

    let writtenId = try EVY.getDataFromText(
      "{\(entityId).transfer_options.pickup.address_id}")
    XCTAssertEqual(writtenId, .string(createdId))
  }

  func testCreateWithDataPathWritesGeneratedIdToDraft() throws {
    let namespace = UUID().uuidString
    let resource = "addresses"
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: UUID().uuidString)
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    let address = EVYJson.dictionary([
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "instructions": .string("Leave at door"),
    ])
    try EVY.writeRawValue(address, to: "{pickup_address}", scopeId: scopeId)

    let createAction = rowAction(
      true: "{create(\(namespace),\(resource),pickup_address,{pickup_address.id})}"
    )
    EVYActionRunner.run(actions: [createAction]) { _ in }

    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(createdRows.count, 1)
    let created = try createdRows[0].decoded()
    guard case .dictionary(let record) = created,
      case .string(let createdId) = record["id"]
    else {
      return XCTFail("expected created address dictionary with id")
    }
    XCTAssertEqual(record["street"], .string("28 Rothschild Avenue"))
    XCTAssertEqual(record["instructions"], .string("Leave at door"))

    XCTAssertEqual(try EVY.getDataFromText("{pickup_address.id}"), .string(createdId))
  }

  func testUpdateWithDataPathStripsForeignIdFromChanges() throws {
    let namespace = UUID().uuidString
    let resource = "addresses"
    let recordId = UUID().uuidString
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: UUID().uuidString)
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    let seed = EVYJson.dictionary([
      "id": .string(recordId),
      "street": .string("Old Street"),
      "city": .string("Sydney"),
    ])
    try EVY.publicStore.create(
      namespace: namespace,
      resource: resource,
      id: recordId,
      value: try JSONEncoder().encode(seed)
    )

    let draft = EVYJson.dictionary([
      "id": .string(UUID().uuidString),
      "street": .string("New Street"),
      "city": .string("Rosebery"),
    ])
    try EVY.writeRawValue(draft, to: "{pickup_address}", scopeId: scopeId)

    let updateAction = rowAction(
      true: "{update(\(namespace),\(resource),{id: \(recordId)},pickup_address)}"
    )
    EVYActionRunner.run(actions: [updateAction]) { _ in }

    let updated = try EVY.publicStore.get(namespace: namespace, resource: resource, id: recordId)
    guard case .dictionary(let values) = try updated.decoded() else {
      return XCTFail("expected updated dictionary")
    }
    XCTAssertEqual(values["id"], .string(recordId))
    XCTAssertEqual(values["street"], .string("New Street"))
    XCTAssertEqual(values["city"], .string("Rosebery"))
  }

  private enum PickupLinkMode {
    case store
    case draft
  }

  private func pickupAddressSaveActions(
    coreNamespace: String,
    addressesResource: String,
    itemsResource: String,
    marketplaceNamespace: String = EVYNamespace.marketplace,
    linkMode: PickupLinkMode = .store
  ) -> [UI_RowAction] {
    let linkAction: String
    switch linkMode {
    case .store:
      linkAction =
        "{update(\(marketplaceNamespace), \(itemsResource), {id: \(itemsResource).id}, {transfer_options.pickup.address_id: pickup_address.id})}"
    case .draft:
      linkAction =
        "{update(\(marketplaceNamespace), \(itemsResource), {}, {transfer_options.pickup.address_id: pickup_address.id}, draft)}"
    }
    return [
      rowAction(
        condition: "{length(\(itemsResource).transfer_options.pickup.address_id) == 0}",
        true:
          "{create(\(coreNamespace), \(addressesResource), pickup_address, {pickup_address.id})}",
        false:
          "{update(\(coreNamespace), \(addressesResource), {id: \(itemsResource).transfer_options.pickup.address_id}, pickup_address)}"
      ),
      rowAction(true: linkAction),
    ]
  }

  func testTwoActionPickupAddressSaveSequence() throws {
    let coreNamespace = "475731ac-31aa-4d65-94d2-7032782ae359"
    let marketplaceNamespace = EVYNamespace.marketplace
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let addressesResource = "addresses"
    let itemId = UUID().uuidString
    let pageId = "pickup-page-\(UUID().uuidString)"
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: pageId)

    try? EVY.publicStore.deleteAll(namespace: coreNamespace, resource: addressesResource)
    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    EVY.activeCacheScopeId = pageId
    defer {
      try? EVY.publicStore.deleteAll(namespace: coreNamespace, resource: addressesResource)
      try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
      EVY.activeCacheScopeId = nil
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: pageId)
    }

    let itemRecord = EVYJson.dictionary([
      "id": .string(itemId),
      "title": .string("Listing"),
      "transfer_options": .dictionary([
        "pickup": .dictionary([
          "selection": .array([.string("2026-06-03T09:00:00")]),
          "lead_time_hours": .int(24),
        ])
      ]),
    ])
    try EVY.publicStore.applySyncedValue(
      namespace: marketplaceNamespace,
      resource: itemsResource,
      value: .array([itemRecord])
    )
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache,
      resource: pageId,
      id: itemsResource,
      value: try JSONEncoder().encode(itemRecord)
    )

    let pickupDraft = EVYJson.dictionary([
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "instructions": .string("Ring bell"),
    ])
    try EVY.writeRawValue(pickupDraft, to: "{pickup_address}", scopeId: scopeId)

    let saveActions = pickupAddressSaveActions(
      coreNamespace: coreNamespace,
      addressesResource: addressesResource,
      itemsResource: itemsResource
    )
    EVYActionRunner.run(actions: saveActions) { _ in }

    let addresses = try EVY.publicStore.getAll(
      namespace: coreNamespace, resource: addressesResource)
    XCTAssertEqual(addresses.count, 1)
    guard case .dictionary(let createdAddress) = try addresses[0].decoded(),
      case .string(let addressId) = createdAddress["id"]
    else {
      return XCTFail("expected created address")
    }
    XCTAssertEqual(try EVY.getDataFromText("{pickup_address.id}"), .string(addressId))

    let publicItem = try EVY.publicStore.getAll(
      namespace: marketplaceNamespace, resource: itemsResource
    )
    .first
    guard case .dictionary(let publicValues) = try publicItem?.decoded() else {
      return XCTFail("expected public item")
    }
    guard case .dictionary(let pickupOptions) = publicValues["transfer_options"],
      case .dictionary(let pickup) = pickupOptions["pickup"]
    else {
      return XCTFail("expected pickup options")
    }
    XCTAssertEqual(pickup["address_id"], .string(addressId))
    XCTAssertEqual(pickup["lead_time_hours"], .int(24))

    let cachedItem = try EVY.cacheStore.get(
      namespace: EVYNamespace.cache, resource: pageId, id: itemsResource)
    guard case .dictionary(let cachedValues) = try cachedItem.decoded(),
      case .dictionary(let cachedPickupOptions) = cachedValues["transfer_options"],
      case .dictionary(let cachedPickup) = cachedPickupOptions["pickup"]
    else {
      return XCTFail("expected cached item pickup options")
    }
    XCTAssertEqual(cachedPickup["address_id"], .string(addressId))

    try EVY.writeRawStringValue(
      "Updated instructions", to: "{pickup_address.instructions}", scopeId: scopeId)
    EVYActionRunner.run(actions: saveActions) { _ in }

    XCTAssertEqual(
      try EVY.publicStore.getAll(namespace: coreNamespace, resource: addressesResource).count, 1)
    let updatedRows = try EVY.publicStore.getAll(
      namespace: coreNamespace, resource: addressesResource)
    guard case .dictionary(let updatedAddress) = try updatedRows[0].decoded() else {
      return XCTFail("expected address after second save")
    }
    XCTAssertEqual(updatedAddress["instructions"], .string("Updated instructions"))
  }

  func testDraftModeUpdateWritesChangesIntoCreateDraft() throws {
    let marketplaceNamespace = EVYNamespace.marketplace
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let flowId = "create-flow"
    let scopeId = EVYDraft.createMergeScopeId(flowId: flowId, entityKey: itemsResource)
    let unrelatedItemId = UUID().uuidString

    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
      EVY.draftStore.deleteDrafts(scopeId: scopeId)
      EVY.draftStore.activeScopeId = nil
    }

    let unrelatedItem = EVYJson.dictionary([
      "id": .string(unrelatedItemId),
      "title": .string("Unrelated listing"),
    ])
    try EVY.publicStore.applySyncedValue(
      namespace: marketplaceNamespace,
      resource: itemsResource,
      value: .array([unrelatedItem])
    )

    let linkAction = rowAction(
      true:
        "{update(\(marketplaceNamespace), \(itemsResource), {}, {transfer_options.pickup.address_id: \"some-address-uuid\"}, draft)}"
    )
    EVYActionRunner.run(actions: [linkAction]) { _ in }

    XCTAssertEqual(
      try EVY.getDataFromText("{\(itemsResource).transfer_options.pickup.address_id}"),
      .string("some-address-uuid"))

    let items = try EVY.publicStore.getAll(namespace: marketplaceNamespace, resource: itemsResource)
    XCTAssertEqual(items.count, 1)
    guard case .dictionary(let unchangedItem) = try items[0].decoded() else {
      return XCTFail("expected unrelated item")
    }
    XCTAssertEqual(unchangedItem["title"], .string("Unrelated listing"))
    XCTAssertEqual(unchangedItem["id"], .string(unrelatedItemId))
  }

  func testStoreModeUpdateMatchingNothingNoOpsInCreateScope() throws {
    let marketplaceNamespace = EVYNamespace.marketplace
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let flowId = "create-flow"
    let scopeId = EVYDraft.createMergeScopeId(flowId: flowId, entityKey: itemsResource)
    let unrelatedItemId = UUID().uuidString

    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
      EVY.draftStore.deleteDrafts(scopeId: scopeId)
      EVY.draftStore.activeScopeId = nil
    }

    let unrelatedItem = EVYJson.dictionary([
      "id": .string(unrelatedItemId),
      "title": .string("Unrelated listing"),
    ])
    try EVY.publicStore.applySyncedValue(
      namespace: marketplaceNamespace,
      resource: itemsResource,
      value: .array([unrelatedItem])
    )

    let linkAction = rowAction(
      true:
        "{update(\(marketplaceNamespace), \(itemsResource), {id: \(itemsResource).id}, {transfer_options.pickup.address_id: \"some-address-uuid\"})}"
    )
    EVYActionRunner.run(actions: [linkAction]) { _ in }

    XCTAssertEqual(try EVY.draftStore.drafts(forScopeId: scopeId).count, 0)

    let items = try EVY.publicStore.getAll(namespace: marketplaceNamespace, resource: itemsResource)
    XCTAssertEqual(items.count, 1)
    guard case .dictionary(let unchangedItem) = try items[0].decoded() else {
      return XCTFail("expected unrelated item")
    }
    XCTAssertEqual(unchangedItem["title"], .string("Unrelated listing"))
    XCTAssertEqual(unchangedItem["id"], .string(unrelatedItemId))
  }

  func testDraftModeUpdateOutsideMatchingCreateScopeErrors() throws {
    let marketplaceNamespace = EVYNamespace.marketplace
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let browseScopeId = "create-flow:browse"

    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = browseScopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    let itemId = UUID().uuidString
    let itemRecord = EVYJson.dictionary([
      "id": .string(itemId),
      "title": .string("Listing"),
    ])
    try EVY.publicStore.applySyncedValue(
      namespace: marketplaceNamespace,
      resource: itemsResource,
      value: .array([itemRecord])
    )

    let linkAction = rowAction(
      true:
        "{update(\(marketplaceNamespace), \(itemsResource), {}, {title: \"patched\"}, draft)}"
    )
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [linkAction]) { _ in }
    }
    XCTAssertFalse(errors.isEmpty)

    let updated = try EVY.publicStore.get(
      namespace: marketplaceNamespace, resource: itemsResource, id: itemId)
    guard case .dictionary(let values) = try updated.decoded() else {
      return XCTFail("expected item")
    }
    XCTAssertEqual(values["title"], .string("Listing"))
  }

  func testUpdateInCreateScopeWithMatchingRowStillUpdatesRow() throws {
    let marketplaceNamespace = EVYNamespace.marketplace
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let flowId = "create-flow"
    let scopeId = EVYDraft.createMergeScopeId(flowId: flowId, entityKey: itemsResource)
    let itemId = UUID().uuidString

    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
      EVY.draftStore.deleteDrafts(scopeId: scopeId)
      EVY.draftStore.activeScopeId = nil
    }

    let itemRecord = EVYJson.dictionary([
      "id": .string(itemId),
      "title": .string("Original title"),
    ])
    try EVY.publicStore.applySyncedValue(
      namespace: marketplaceNamespace,
      resource: itemsResource,
      value: .array([itemRecord])
    )

    let updateAction = rowAction(
      true:
        "{update(\(marketplaceNamespace), \(itemsResource), {id: \"\(itemId)\"}, {title: \"Archived title\"})}"
    )
    EVYActionRunner.run(actions: [updateAction]) { _ in }

    let updated = try EVY.publicStore.get(
      namespace: marketplaceNamespace, resource: itemsResource, id: itemId)
    guard case .dictionary(let values) = try updated.decoded() else {
      return XCTFail("expected updated item")
    }
    XCTAssertEqual(values["title"], .string("Archived title"))

    XCTAssertEqual(try EVY.draftStore.drafts(forScopeId: scopeId).count, 0)
  }

  func testCreateFlowTwoActionAddressSaveLinksItemDraftAndRepickUpdates() throws {
    let coreNamespace = "475731ac-31aa-4d65-94d2-7032782ae359"
    let marketplaceNamespace = EVYNamespace.marketplace
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let addressesResource = "addresses"
    let flowId = "create-flow"
    let scopeId = EVYDraft.createMergeScopeId(flowId: flowId, entityKey: itemsResource)

    try? EVY.publicStore.deleteAll(namespace: coreNamespace, resource: addressesResource)
    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: coreNamespace, resource: addressesResource)
      try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
      EVY.draftStore.deleteDrafts(scopeId: scopeId)
      EVY.draftStore.activeScopeId = nil
    }

    let pickupDraft = EVYJson.dictionary([
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "instructions": .string("Ring bell"),
    ])
    try EVY.writeRawValue(pickupDraft, to: "{pickup_address}", scopeId: scopeId)

    let saveActions = pickupAddressSaveActions(
      coreNamespace: coreNamespace,
      addressesResource: addressesResource,
      itemsResource: itemsResource,
      linkMode: .draft
    )
    EVYActionRunner.run(actions: saveActions) { _ in }

    let addresses = try EVY.publicStore.getAll(
      namespace: coreNamespace, resource: addressesResource)
    XCTAssertEqual(addresses.count, 1)
    guard case .dictionary(let createdAddress) = try addresses[0].decoded(),
      case .string(let addressId) = createdAddress["id"]
    else {
      return XCTFail("expected created address")
    }
    XCTAssertEqual(try EVY.getDataFromText("{pickup_address.id}"), .string(addressId))
    XCTAssertEqual(
      try EVY.getDataFromText("{\(itemsResource).transfer_options.pickup.address_id}"),
      .string(addressId))

    try EVY.writeRawValue(
      EVYJson.dictionary([
        "street": .string("99 George Street"),
        "city": .string("Sydney"),
        "instructions": .string("Ring bell"),
      ]),
      to: "{pickup_address}",
      scopeId: scopeId
    )
    EVYActionRunner.run(actions: saveActions) { _ in }

    XCTAssertEqual(
      try EVY.publicStore.getAll(namespace: coreNamespace, resource: addressesResource).count, 1)
    let updatedRows = try EVY.publicStore.getAll(
      namespace: coreNamespace, resource: addressesResource)
    guard case .dictionary(let updatedAddress) = try updatedRows[0].decoded(),
      case .string(let updatedId) = updatedAddress["id"]
    else {
      return XCTFail("expected address after re-pick")
    }
    XCTAssertEqual(updatedId, addressId)
    XCTAssertEqual(updatedAddress["street"], .string("99 George Street"))

    _ = try EVY.create(namespace: marketplaceNamespace, resource: itemsResource, isSubmission: true)
    let items = try EVY.publicStore.getAll(
      namespace: marketplaceNamespace, resource: itemsResource)
    XCTAssertEqual(items.count, 1)
    guard case .dictionary(let itemDict) = try items[0].decoded(),
      case .dictionary(let transfer)? = itemDict["transfer_options"],
      case .dictionary(let pickup)? = transfer["pickup"]
    else {
      return XCTFail("expected item with pickup options")
    }
    XCTAssertEqual(pickup["address_id"], .string(addressId))
    XCTAssertNil(itemDict["pickup_address"])
  }

  func testUpdateActionParserParsesFilterAndChanges() {
    let action = EVYActionParser.updateAction(
      from:
        "{update(ns,res,{fk: abc.id, archivedAt: null},{archivedAt: now()})}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(action?.filter, ["fk": "abc.id", "archivedAt": "null"])
    XCTAssertEqual(action?.changes, .literal(["archivedAt": "now()"]))
    XCTAssertEqual(action?.mode, .store)
  }

  func testUpdateActionParserParsesDraftMode() {
    let action = EVYActionParser.updateAction(
      from: "{update(ns,res,{},{transfer_options.pickup.address_id: pickup_address.id},draft)}"
    )

    XCTAssertEqual(action?.mode, .draft)
    XCTAssertEqual(action?.filter, [:])
    XCTAssertEqual(
      action?.changes,
      .literal(["transfer_options.pickup.address_id": "pickup_address.id"]))
  }

  func testUpdateActionParserRejectsNonEmptyFilterWithDraftMode() {
    XCTAssertNil(
      EVYActionParser.updateAction(
        from: "{update(ns,res,{id: abc},{title: x},draft)}"))
  }

  func testUpdateActionParserRejectsUnknownMode() {
    XCTAssertNil(
      EVYActionParser.updateAction(
        from: "{update(ns,res,{},{title: x},store)}"))
  }

  func testUpdateActionParserRejectsSixArgs() {
    XCTAssertNil(
      EVYActionParser.updateAction(
        from: "{update(ns,res,{},{title: x},draft,extra)}"))
  }

  func testUpdateActionParserRejectsMissingFilterOrChanges() {
    XCTAssertNil(EVYActionParser.updateAction(from: "{update(ns,res)}"))
    XCTAssertNil(EVYActionParser.updateAction(from: "{update(ns,res,{id: abc})}"))
    XCTAssertNil(
      EVYActionParser.updateAction(from: "{update(ns,res,{}, {archivedAt: now()})}"))
    XCTAssertNil(
      EVYActionParser.updateAction(from: "{update(ns,res,{fk: abc},{})}"))
  }

  func testResolveInlineCreateDataMapsLiterals() throws {
    let namespace = EVYNamespace.marketplace
    let resource = "literal-create-actions"
    let pinnedDate = Date(timeIntervalSince1970: 1_780_000_000)
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    EVY.nowProvider = { pinnedDate }
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      EVY.nowProvider = { Date() }
    }

    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{fk: item-1, service: \"svc-1\", archivedAt: null, verified: true, data: {type: pickup, time: 2026-06-03T09:00:00}})}"
    )
    var received: ActionOperation?
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertNil(received)

    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected inline create payload dictionary")
    }
    XCTAssertEqual(values["fk"], .string("item-1"))
    XCTAssertEqual(values["service"], .string("svc-1"))
    XCTAssertEqual(values["archivedAt"], .null)
    XCTAssertEqual(values["verified"], .bool(true))
    XCTAssertEqual(
      values["data"],
      .dictionary([
        "type": .string("pickup"),
        "time": .string("2026-06-03T09:00:00"),
      ]))
    XCTAssertEqual(values["createdAt"], .string(pinnedDate.ISO8601Format()))
  }

  func testInlineCreateDataKeepsExplicitCreatedAt() throws {
    let namespace = EVYNamespace.marketplace
    let resource = "created-at-create-actions"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }

    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{fk: item-1, createdAt: \"2026-06-01T00:00:00Z\"})}"
    )
    EVYActionRunner.run(actions: [action]) { _ in }

    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected inline create payload dictionary")
    }
    XCTAssertEqual(values["createdAt"], .string("2026-06-01T00:00:00Z"))
  }

  func testUpdateActionAcceptsOnlyMatchingPendingMessageForDatum() throws {
    let namespace = EVYNamespace.evy
    let resource = MarketplaceTestFixture.messagesResourceId
    let itemId = UUID().uuidString
    let pendingMessageId = UUID().uuidString
    let otherPendingMessageId = UUID().uuidString
    let acceptedMessageId = UUID().uuidString
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }

    let messages = EVYJson.array([
      EVYTestMessageFixtures.message(
        id: pendingMessageId,
        fk: itemId,
        status: "pending",
        archivedAt: .null,
        type: "pickup",
        time: "2026-06-03T09:00:00"
      ),
      EVYTestMessageFixtures.message(
        id: otherPendingMessageId,
        fk: itemId,
        status: "pending",
        archivedAt: .null,
        type: "delivery",
        time: "2026-06-03T10:00:00"
      ),
      EVYTestMessageFixtures.message(
        id: acceptedMessageId,
        fk: itemId,
        status: "accepted",
        archivedAt: .null,
        type: "shipping",
        postalcode: "2018"
      ),
    ])
    try EVY.applySyncedValue(namespace: namespace, resource: resource, value: messages)

    let acceptAction = rowAction(
      true:
        "{update(\(namespace),\(resource),{id: $datum.id, status: \"pending\"},{status: \"accepted\"})}"
    )

    let pendingDatum = EVYJson.dictionary(["id": .string(pendingMessageId)])
    EVYActionRunner.run(actions: [acceptAction], datum: pendingDatum) { _ in }

    let statusById = try statusByMessageId(namespace: namespace, resource: resource)
    XCTAssertEqual(statusById[pendingMessageId], "accepted")
    XCTAssertEqual(statusById[otherPendingMessageId], "pending")
    XCTAssertEqual(statusById[acceptedMessageId], "accepted")

    EVYActionRunner.run(
      actions: [acceptAction],
      datum: EVYJson.dictionary(["id": .string(acceptedMessageId)])
    ) { _ in }

    let afterNoOp = try statusByMessageId(namespace: namespace, resource: resource)
    XCTAssertEqual(afterNoOp[acceptedMessageId], "accepted")
  }

  private func statusByMessageId(namespace: String, resource: String) throws -> [String: String] {
    let rows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    return Dictionary(
      uniqueKeysWithValues: rows.compactMap { row -> (String, String)? in
        guard let decoded = try? row.decoded(),
          case .dictionary(let values) = decoded,
          case .string(let id) = values["id"],
          case .string(let status) = values["status"]
        else { return nil }
        return (id, status)
      })
  }

  func testInlineCreateActionWritesResolvedPayloadWithoutNavigating() throws {
    let namespace = "test"
    let resource = "inline-create-actions"
    let scopeId = "__test__:inline-create"
    let selectedTimeslot = "2026-06-03T09:00:00"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    EVY.ensureDraftExists(variableName: "selected_pickup_timeslot", scopeId: scopeId)
    try EVY.updateValue(
      selectedTimeslot,
      destination: "{selected_pickup_timeslot}",
      scopeId: scopeId
    )

    let datum = EVYJson.dictionary(["id": .string("item-id")])
    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{fk: $datum.id, data: {type: pickup, time: selected_pickup_timeslot}})}"
    )
    var receivedNavigation: ActionOperation?

    EVYActionRunner.run(actions: [action], datum: datum) { receivedNavigation = $0 }

    XCTAssertNil(receivedNavigation)
    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected inline create payload dictionary")
    }
    XCTAssertEqual(values["fk"], .string("item-id"))
    XCTAssertEqual(
      values["data"],
      .dictionary([
        "type": .string("pickup"),
        "time": .string(selectedTimeslot),
      ]),
      "Nested data values should resolve drafts like top-level values")
    XCTAssertEqual(values["id"]?.toString(), createdRows.first?.id)
  }

  func testShowActionInvokesShowWithParsedRowId() {
    var shownRowId: String?
    let action = rowAction(true: "{show(child-row)}")
    EVYActionRunner.run(actions: [action], show: { rowId in shownRowId = rowId }) { _ in }
    XCTAssertEqual(shownRowId, "child-row")
  }

  func testShowActionWithQuotedRowId() {
    var shownRowId: String?
    let action = rowAction(true: "{show(\"quoted-row\")}")
    EVYActionRunner.run(actions: [action], show: { rowId in shownRowId = rowId }) { _ in }
    XCTAssertEqual(shownRowId, "quoted-row")
  }

  func testShowActionWithMissingArgumentPostsError() {
    let action = rowAction(true: "{show()}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action], show: { _ in }) { _ in }
    }
    XCTAssertFalse(errors.isEmpty)
  }

  func testShowActionWithEmptyArgumentPostsError() {
    let action = rowAction(true: "{show( )}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action], show: { _ in }) { _ in }
    }
    XCTAssertFalse(errors.isEmpty)
  }

  func testShowActionWithExtraArgumentPostsError() {
    let action = rowAction(true: "{show(row-one, row-two)}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action], show: { _ in }) { _ in }
    }
    XCTAssertFalse(errors.isEmpty)
  }

  func testShowActionThrowingShowCallbackPostsError() {
    let action = rowAction(true: "{show(missing-row)}")
    let errors = capturedErrors {
      EVYActionRunner.run(
        actions: [action],
        show: { _ in
          throw EVYError.invalidData(context: "unresolved show target")
        }
      ) { _ in }
    }
    XCTAssertFalse(errors.isEmpty)
  }

  func testFalseBranchShowActionInvokesShowWithParsedRowId() {
    var shownRowId: String?
    let action = rowAction(condition: "{false}", true: "", false: "{show(sheet-row)}")
    EVYActionRunner.run(actions: [action], show: { rowId in shownRowId = rowId }) { _ in }
    XCTAssertEqual(shownRowId, "sheet-row")
  }

  func testSingleIdArgumentRejectsInvalidArgs() {
    XCTAssertNil(EVYActionParser.singleIdArgument(fromArgs: ""))
    XCTAssertNil(EVYActionParser.singleIdArgument(fromArgs: "a, b"))
    XCTAssertNil(EVYActionParser.singleIdArgument(fromArgs: "flow, page"))
    XCTAssertEqual(EVYActionParser.singleIdArgument(fromArgs: "target-id"), "target-id")
  }

  func testSelectDispatchesBareDatum() {
    let datum = EVYJson.dictionary([
      "dateTimeISO": .string("2026-06-03T11:00:00"),
      "label": .string("11:00"),
    ])
    var received: EVYRowActionOperation?
    let selectAction = rowAction(true: "{select($datum)}")
    let closeAction = rowAction(true: "{close()}")
    var receivedOps: [ActionOperation] = []
    EVYActionRunner.run(
      actions: [selectAction, closeAction],
      datum: datum,
      rowOperation: { received = $0 }
    ) { receivedOps.append($0) }
    assertSelectValue(received, equals: datum)
    XCTAssertEqual(receivedOps, [.close])
  }

  func testSelectDispatchesArrayDatum() {
    let datum = EVYJson.array([
      .string("2026-06-03T09:00:00"),
      .string("2026-06-04T09:00:00"),
    ])
    var received: EVYRowActionOperation?
    EVYActionRunner.run(
      actions: [rowAction(true: "{select($datum)}")],
      datum: datum,
      rowOperation: { received = $0 }
    ) { _ in }
    assertSelectValue(received, equals: datum)
  }

  func testSelectResolvesDatumProperty() {
    let datum = EVYJson.dictionary([
      "dateTimeISO": .string("2026-06-03T11:00:00")
    ])
    var received: EVYRowActionOperation?
    EVYActionRunner.run(
      actions: [rowAction(true: "{select($datum.dateTimeISO)}")],
      datum: datum,
      rowOperation: { received = $0 }
    ) { _ in }
    assertSelectValue(received, equals: .string("2026-06-03T11:00:00"))
  }

  func testSelectPassesQuotedLiteral() {
    var received: EVYRowActionOperation?
    EVYActionRunner.run(
      actions: [rowAction(true: "{select(\"literal\")}")],
      rowOperation: { received = $0 }
    ) { _ in }
    assertSelectValue(received, equals: .string("literal"))
  }

  func testSelectWithInvalidArgumentPostsErrorAndStops() {
    for branch in ["{select()}", "{select(a, b)}"] {
      var receivedOps: [ActionOperation] = []
      var rowOps: [EVYRowActionOperation] = []
      let errors = capturedErrors {
        EVYActionRunner.run(
          actions: [rowAction(true: branch), rowAction(true: "{close()}")],
          rowOperation: { rowOps.append($0) }
        ) { receivedOps.append($0) }
      }
      XCTAssertFalse(errors.isEmpty, "Expected error for \(branch)")
      XCTAssertTrue(rowOps.isEmpty, "Expected no row ops for \(branch)")
      XCTAssertTrue(receivedOps.isEmpty, "Expected stop for \(branch)")
    }
  }

  func testRowPhotoOperationsDispatchesAndContinues() {
    let cases: [(String, (EVYRowActionOperation) -> Bool)] = [
      (
        "{delete_photo()}",
        {
          if case .deletePhoto = $0 { return true }
          return false
        }
      ),
      (
        "{select_photo()}",
        {
          if case .selectPhoto = $0 { return true }
          return false
        }
      ),
      (
        "{expand_photo()}",
        {
          if case .expandPhoto = $0 { return true }
          return false
        }
      ),
    ]
    for (action, matcher) in cases {
      assertRowPhotoOperationDispatchesAndContinues(action: action, expected: matcher)
    }
  }

  func testTriggerIsolationRunsOnlyRequestedActionList() {
    let closeAction = rowAction(true: "{close()}")
    let actions = UI_RowActions(
      delete: [closeAction],
      submit: [closeAction],
      swipeLeft: [closeAction],
      tap: [closeAction]
    )
    let lists: [(String, [UI_RowAction])] = [
      ("tap", actions.tap),
      ("delete", actions.delete),
      ("swipeLeft", actions.swipeLeft),
      ("submit", actions.submit),
    ]
    for (name, onlyList) in lists {
      var tapReceived = false
      var deleteReceived = false
      var swipeLeftReceived = false
      var submitReceived = false
      EVYActionRunner.run(actions: onlyList) { operation in
        guard case .close = operation else { return }
        switch name {
        case "tap": tapReceived = true
        case "delete": deleteReceived = true
        case "swipeLeft": swipeLeftReceived = true
        case "submit": submitReceived = true
        default: break
        }
      }
      XCTAssertEqual(tapReceived, name == "tap", "Only tap list should run tap actions")
      XCTAssertEqual(deleteReceived, name == "delete", "Only delete list should run delete actions")
      XCTAssertEqual(
        swipeLeftReceived, name == "swipeLeft", "Only swipeLeft list should run swipe-left actions")
      XCTAssertEqual(
        submitReceived, name == "submit", "Only submit list should run submit actions")
    }
  }

  func testSelectWithDefaultRowOperationPostsErrorAndStops() {
    var receivedOps: [ActionOperation] = []
    let errors = capturedErrors {
      EVYActionRunner.run(
        actions: [rowAction(true: "{select($datum)}"), rowAction(true: "{close()}")],
        datum: .string("slot")
      ) { receivedOps.append($0) }
    }
    XCTAssertFalse(errors.isEmpty)
    XCTAssertTrue(receivedOps.isEmpty)
  }

  func testExpandTextPostsNotificationWithRowId() {
    var postedRowId: String?
    let token = NotificationCenter.default.addObserver(
      forName: .evyExpandTextRow, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        postedRowId = notification.object as? String
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    var receivedOps: [ActionOperation] = []
    EVYActionRunner.run(
      actions: [rowAction(true: "{expand_text(text-expand-row)}"), rowAction(true: "{close()}")]
    ) { receivedOps.append($0) }

    XCTAssertEqual(postedRowId, "text-expand-row")
    XCTAssertEqual(receivedOps, [.close])
  }

  func testExpandTextWithInvalidArgsPostsErrorAndStops() {
    for branch in ["{expand_text()}", "{expand_text(a, b)}", "{expand_text( )}"] {
      var receivedOps: [ActionOperation] = []
      let errors = capturedErrors {
        EVYActionRunner.run(
          actions: [rowAction(true: branch), rowAction(true: "{close()}")]
        ) { receivedOps.append($0) }
      }
      XCTAssertFalse(errors.isEmpty, "Expected error for \(branch)")
      XCTAssertTrue(receivedOps.isEmpty, "Expected stop for \(branch)")
    }
  }

  func testNavigateWithBraceFunction() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flow-1,page-2)}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate, got \(String(describing: received))")
      return
    }
    XCTAssertEqual(route.flowId, "flow-1")
    XCTAssertEqual(route.pageId, "page-2")
    XCTAssertEqual(route.query, [:])
  }

  func testNavigateWithBraceFunctionAndPlainTextQueryArgument() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flow-1,page-2,{items: [id-1, id-2]})}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate, got \(String(describing: received))")
      return
    }
    XCTAssertEqual(route.flowId, "flow-1")
    XCTAssertEqual(route.pageId, "page-2")
    XCTAssertEqual(route.query["items"], ["id-1", "id-2"])
  }

  func testNavigateNonPlainTextQueryArgumentPostsError() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flow-1,page-2,notJson)}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action]) { received = $0 }
    }
    XCTAssertFalse(errors.isEmpty)
    XCTAssertNil(received)
  }

  func testHighlightRequiredFormatsFieldLabel() {
    var received: ActionOperation?
    let action = rowAction(true: "{highlight_required(unit_price)}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .highlightRequired(let label) = received else {
      XCTFail("Expected highlightRequired")
      return
    }
    XCTAssertEqual(label, "Unit Price")
  }

  func testHighlightRequiredFormatsUuidQualifiedFieldLabel() {
    var received: ActionOperation?
    let action = rowAction(
      true: "{highlight_required(\(MarketplaceTestFixture.itemsResourceId).pickup_selection)}"
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .highlightRequired(let label) = received else {
      XCTFail("Expected highlightRequired")
      return
    }
    XCTAssertEqual(label, "Pickup Selection")
  }

  func testUnsupportedFunctionPostsErrorNotification() {
    let action = rowAction(true: "{notARealEvyFunction()}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action]) { _ in }
    }
    XCTAssertFalse(errors.isEmpty)
  }

  func testNavigateWithDatumResolvesId() {
    var received: ActionOperation?
    let datum = EVYJson.dictionary([
      "id": .string("resolved-uuid"),
      "title": .string("Test Item"),
    ])
    let action = rowAction(true: "{navigate(flowX,pageY,{items: $datum.id})}")
    EVYActionRunner.run(actions: [action], datum: datum) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.flowId, "flowX")
    XCTAssertEqual(route.pageId, "pageY")
    XCTAssertEqual(route.query["items"], ["resolved-uuid"])
  }

  func testNavigateWithCommaInQuery() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flowX,pageY,{items: [a], kind: item})}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.query["items"], ["a"])
    XCTAssertEqual(route.query["kind"], ["item"])
  }

  func testNavigateSkipsEmptyQueryValues() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flowX,pageY,{items: [], kind: item, empty: })}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertNil(route.query["items"])
    XCTAssertEqual(route.query["kind"], ["item"])
    XCTAssertNil(route.query["empty"])
  }

  func testNavigateWithMissingQueryColonPostsError() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flowX,pageY,{items [a]})}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action]) { received = $0 }
    }
    XCTAssertFalse(errors.isEmpty)
    XCTAssertNil(received)
  }

  func testNavigateWithUnclosedQueryArrayPostsError() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flowX,pageY,{items: [a})}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action]) { received = $0 }
    }
    XCTAssertFalse(errors.isEmpty)
    XCTAssertNil(received)
  }

  func testNavigateWithTooManyArgsThrowsError() {
    let action = rowAction(true: "{navigate(flowX,pageY,{key: val},extra)}")
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action]) { _ in }
    }
    XCTAssertFalse(errors.isEmpty)
  }

  func testNavigateWithoutDatumKeepsDatumExpression() {
    var received: ActionOperation?
    let action = rowAction(true: "{navigate(flowX,pageY,{items: $datum.id})}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.query["items"], ["$datum.id"])
  }

  func testFalseBranchWithoutCreateRunsHighlightRequired() {
    let messagesResourceId = MarketplaceTestFixture.messagesResourceId
    let itemResourceId = MarketplaceTestFixture.itemsResourceId
    var received: ActionOperation?
    let action = rowAction(
      condition: "{length(shipping_address.postcode) > 0}",
      true:
        "{create(\(EVYNamespace.evy),\(messagesResourceId),{fk: \(itemResourceId).id, archivedAt: null, data: {type: shipping, postalcode: shipping_address.postcode}})}",
      false: "{highlight_required(postcode)}"
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertEqual(received, .highlightRequired("Postcode"))
  }

  func testCreateActionRunsImmediately() throws {
    let namespace = EVYNamespace.evy
    let resource = MarketplaceTestFixture.messagesResourceId
    let itemResourceId = MarketplaceTestFixture.itemsResourceId
    let itemId = UUID().uuidString
    let itemTitle = "Pickup Item Title"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: itemResourceId)
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: itemResourceId)
    }

    try EVY.publicStore.applySyncedValue(
      namespace: namespace,
      resource: itemResourceId,
      value: .array([
        .dictionary([
          "id": .string(itemId),
          "title": .string(itemTitle),
        ])
      ])
    )
    EVY.cacheQueryParams([itemResourceId: [itemId]], forPageId: "test-page")

    var received: ActionOperation?
    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{fk: \(itemResourceId).id, archivedAt: null, data: {type: pickup, time: 2026-06-03T09:00:00}})}"
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }

    XCTAssertNil(received)
    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(createdRows.count, 1)
  }

  func testDatumRowFormatterResolvesDatumReferencesInActions() throws {
    let navigateAction = "{navigate(flowX,pageY,{id: $datum.id})}"
    let updateAction =
      "{update(\(EVY_CORE_SERVICE), \(EVYCoreResource.messages.rawValue), {id: $datum.id, status: \"pending\"}, {status: \"accepted\"})}"
    let row = try decodeRow(
      content: """
        {
          "title": "{$datum.title}",
          "subtitle": "{$datum.status}"
        }
        """,
      actions: UI_RowActions(
        swipeLeft: [rowAction(true: updateAction)],
        tap: [rowAction(true: navigateAction)]
      )
    )
    let formatter = try EVYDatumRowFormatter(template: row)
    let datum = EVYJson.dictionary([
      "id": .string("resolved-uuid"),
      "title": .string("Resolved Title"),
      "status": .string("pending"),
    ])

    let formattedRow = try formatter.formattedResult(datum: datum).row

    XCTAssertEqual(formattedRow.id, row.id)
    XCTAssertEqual(formattedRow.title, "Resolved Title")
    XCTAssertEqual(formattedRow.actions.tap.first?.true, navigateAction)
    XCTAssertEqual(formattedRow.actions.swipeLeft.first?.true, updateAction)
  }

  func testSwipeLeftUpdateActionAcceptsPendingMessageFromFormattedSearchResult() throws {
    let namespace = EVYNamespace.evy
    let resource = MarketplaceTestFixture.messagesResourceId
    let pendingMessageId = UUID().uuidString
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }

    let message = EVYTestMessageFixtures.message(
      id: pendingMessageId,
      status: "pending",
      type: "pickup",
      time: "2026-06-03T09:00:00"
    )
    try EVY.publicStore.applySyncedValue(
      namespace: namespace, resource: resource, value: .array([message]))

    let template = try decodeRow(
      content: """
        {
          "title": "{$datum.data.type} request",
          "subtitle": "{$datum.status}"
        }
        """,
      actions: UI_RowActions(
        swipeLeft: [
          rowAction(
            true:
              "{update(\(namespace),\(resource),{id: $datum.id, status: \"pending\"},{status: \"accepted\"})}"
          )
        ]
      )
    )
    let results = EVYSearchResult.makeResults(
      from: .array([message]),
      resultTemplate: template,
      scopeId: nil
    )
    let result = try XCTUnwrap(results.first)

    EVYActionRunner.run(
      actions: result.displayRow.actions.swipeLeft,
      datum: result.datum
    ) { _ in }

    let statusById = try statusByMessageId(namespace: namespace, resource: resource)
    XCTAssertEqual(statusById[pendingMessageId], "accepted")
  }

  private func makeRowWithSheet() throws -> UI_Row {
    try decodeRow(
      content: """
        {
          "title": "",
          "label": "Show sheet",
          "sheet": {
            "id": "sheet-row",
            "type": "Text",
            "source": "",
            "destination": "",
            "title": "Sheet",
            "text": "Body",
            "actions": {},
            "visible": "true"
          }
        }
        """
    )
  }

  private func capturedErrors(during body: () -> Void) -> [Error] {
    var errors: [Error] = []
    let token = NotificationCenter.default.addObserver(
      forName: .evyErrorOccurred, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        if let error = notification.object as? Error { errors.append(error) }
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }
    body()
    return errors
  }

  private func decodeRow(
    content: String,
    actions: UI_RowActions = UI_RowActions()
  ) throws -> UI_Row {
    let actionsData = try JSONEncoder().encode(actions)
    let actionsJson = try XCTUnwrap(String(data: actionsData, encoding: .utf8))
    let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
    let rowAttributes = String(trimmedContent.dropFirst().dropLast())
    let json = """
      {
        "id": "parent-row",
        "type": "Button",
        "source": "",
        "destination": "",
        "visible": "true",
        \(rowAttributes),
        "actions": \(actionsJson)
      }
      """
    let data = try XCTUnwrap(json.data(using: .utf8))
    return try JSONDecoder().decode(UI_Row.self, from: data)
  }
}
