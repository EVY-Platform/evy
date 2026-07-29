//
//  EVYActionRunnerTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYActionRunnerTests: XCTestCase {
  /// Binding keys seeded for the inline-payload cases, cleaned up per run.
  private var seededBindingKeys: [String] = []

  override func setUp() async throws {
    try await super.setUp()
    installHermeticMutationSync()
  }

  override func tearDown() async throws {
    resetHermeticMutationSync()
    try await super.tearDown()
  }

  private func runBranchCapturing(
    _ branch: EVYActionBranch
  ) -> (
    operations: [ActionOperation], shown: [String], rowOps: [EVYRowActionOperation],
    errors: [Error]
  ) {
    var operations: [ActionOperation] = []
    var shown: [String] = []
    var rowOps: [EVYRowActionOperation] = []
    var errors: [Error] = []
    let observer = NotificationCenter.default.addObserver(
      forName: .evyErrorOccurred, object: nil, queue: nil
    ) { note in
      if let error = note.object as? Error { errors.append(error) }
    }
    defer { NotificationCenter.default.removeObserver(observer) }

    EVYActionRunner.run(
      actions: [UI_RowAction(condition: "", false: .empty, true: branch)],
      datum: .dictionary(["id": .string("datum-id")]),
      show: { shown.append($0) },
      rowOperation: { rowOps.append($0) }
    ) { operations.append($0) }

    return (operations, shown, rowOps, errors)
  }

  func testStructuredBranchWithUnsupportedShapeIsRejectedAtDecode() {
    let json = Data(#"{"condition":"","false":"","true":{"fn":"teleport"}}"#.utf8)
    XCTAssertThrowsError(try JSONDecoder().decode(UI_RowAction.self, from: json))
  }

  // MARK: - Condition evaluation errors

  private func runCapturingErrors(
    _ actions: [UI_RowAction]
  ) -> (errors: [Error], operations: [ActionOperation]) {
    var errors: [Error] = []
    var operations: [ActionOperation] = []
    let observer = NotificationCenter.default.addObserver(
      forName: .evyErrorOccurred, object: nil, queue: nil
    ) { note in
      if let error = note.object as? Error { errors.append(error) }
    }
    defer { NotificationCenter.default.removeObserver(observer) }

    EVYActionRunner.run(actions: actions) { operations.append($0) }
    return (errors, operations)
  }

  func testUnevaluatableConditionSurfacesErrorAndStops() {
    let result = runCapturingErrors([
      rowAction(condition: "{&&}", true: .close, false: .close),
      rowAction(true: .close),
    ])

    XCTAssertEqual(result.errors.count, 1, "a broken condition should surface exactly one error")
    XCTAssertTrue(
      result.operations.isEmpty,
      "neither branch nor later actions should run: \(result.operations)")
  }

  func testConditionEvaluatingFalseStillRunsFalseBranchAndStops() {
    let result = runCapturingErrors([
      rowAction(
        condition: "{1 == 2}", true: .navigate(flowId: "f", pageId: "p", query: [:]), false: .close),
      rowAction(true: .navigate(flowId: "f2", pageId: "p2", query: [:])),
    ])

    XCTAssertTrue(result.errors.isEmpty, "a false condition is not an error: \(result.errors)")
    XCTAssertEqual(result.operations.count, 1)
    guard case .close = result.operations.first else {
      return XCTFail("expected the false branch to run, got \(result.operations)")
    }
  }

  /// Documented in sdui.md: boolean literals are valid standalone conditions.
  /// `{true}` previously resolved as a data path and silently evaluated false.
  func testStandaloneBooleanLiteralConditions() {
    let trueResult = runCapturingErrors([
      rowAction(
        condition: "{true}", true: .close, false: .navigate(flowId: "f", pageId: "p", query: [:]))
    ])
    XCTAssertTrue(trueResult.errors.isEmpty, "\(trueResult.errors)")
    guard case .close = trueResult.operations.first else {
      return XCTFail("{true} should take the true branch, got \(trueResult.operations)")
    }

    let falseResult = runCapturingErrors([
      rowAction(
        condition: "{false}", true: .navigate(flowId: "f", pageId: "p", query: [:]), false: .close)
    ])
    XCTAssertTrue(falseResult.errors.isEmpty, "\(falseResult.errors)")
    guard case .close = falseResult.operations.first else {
      return XCTFail("{false} should take the false branch, got \(falseResult.operations)")
    }
  }

  func testEmptyConditionRunsTrueBranch() {
    let result = runCapturingErrors([rowAction(condition: "", true: .close)])

    XCTAssertTrue(result.errors.isEmpty)
    XCTAssertEqual(result.operations.count, 1)
    guard case .close = result.operations.first else {
      return XCTFail("expected the true branch to run, got \(result.operations)")
    }
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
    action: EVYActionInvocation,
    expected: (EVYRowActionOperation) -> Bool
  ) {
    var received: EVYRowActionOperation?
    var receivedOps: [ActionOperation] = []
    EVYActionRunner.run(
      actions: [rowAction(true: action), rowAction(true: .close)],
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
    let action = rowAction(true: .close)
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertEqual(received, .close)
  }

  func testCreateActionPersistsFlowSubmissionAndEmitsNothing() throws {
    let namespace = MarketplaceTestFixture.serviceId
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
    let action = rowAction(
      true: .create(service: namespace, resource: resource, mode: .submit, idDestination: nil))
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
    let namespace = MarketplaceTestFixture.serviceId
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
    let createAction = rowAction(
      true: .create(service: namespace, resource: resource, mode: .submit, idDestination: nil))
    let closeAction = rowAction(true: .close)
    EVYActionRunner.run(actions: [createAction, closeAction]) { receivedOperations.append($0) }

    XCTAssertEqual(receivedOperations, [.close])
    let createdRows = allFromSyncedStores(namespace: namespace, resource: resource)
    XCTAssertEqual(createdRows.count, 1)
  }

  // A malformed action can no longer be stored, so this exercises the runner's
  // halt-on-throw behaviour with an action the row cannot service instead.
  func testChainHaltsWhenActionThrows() {
    let throwingAction = rowAction(true: .select(value: "$datum"))
    let closeAction = rowAction(true: .close)
    var received: ActionOperation?
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [throwingAction, closeAction]) { received = $0 }
    }
    XCTAssertFalse(errors.isEmpty, "select on a row with no handler should post an error")
    XCTAssertNil(received, "close should not run once an earlier action throws")
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
        .create(
          service: namespace, resource: resource,
          mode: .inline(data: ["street": "Rothschild Avenue"]),
          idDestination: "\(entityId).transfer_options.pickup.address_id")
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
      true: .create(
        service: namespace, resource: resource, mode: .fromPath(dataPath: "pickup_address"),
        idDestination: "pickup_address.id")
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
      true: .update(
        service: namespace, resource: resource, mode: .store, filter: ["id": recordId],
        changes: .path("pickup_address"))
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
    marketplaceNamespace: String = MarketplaceTestFixture.serviceId,
    linkMode: PickupLinkMode = .store
  ) -> [UI_RowAction] {
    let linkAction: EVYActionInvocation
    switch linkMode {
    case .store:
      linkAction =
        .update(
          service: marketplaceNamespace, resource: itemsResource, mode: .store,
          filter: ["id": "\(itemsResource).id"],
          changes: .literal(["transfer_options.pickup.address_id": "pickup_address.id"]))
    case .draft:
      linkAction =
        .update(
          service: marketplaceNamespace, resource: itemsResource, mode: .draft, filter: [:],
          changes: .literal(["transfer_options.pickup.address_id": "pickup_address.id"]))
    }
    return [
      rowAction(
        condition: "{length(\(itemsResource).transfer_options.pickup.address_id) == 0}",
        true:
          .create(
            service: coreNamespace, resource: addressesResource,
            mode: .fromPath(dataPath: "pickup_address"), idDestination: "pickup_address.id"),
        false:
          .update(
            service: coreNamespace, resource: addressesResource, mode: .store,
            filter: ["id": "\(itemsResource).transfer_options.pickup.address_id"],
            changes: .path("pickup_address"))
      ),
      rowAction(true: linkAction),
    ]
  }

  func testTwoActionPickupAddressSaveSequence() throws {
    let coreNamespace = "475731ac-31aa-4d65-94d2-7032782ae359"
    let marketplaceNamespace = MarketplaceTestFixture.serviceId
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let addressesResource = "addresses"
    let itemId = UUID().uuidString
    let pageId = "pickup-page-\(UUID().uuidString)"
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: pageId)

    deleteFromSyncedStores(namespace: coreNamespace, resource: addressesResource)
    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    EVY.activeCacheScopeId = pageId
    defer {
      deleteFromSyncedStores(namespace: coreNamespace, resource: addressesResource)
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

    let addresses = allFromSyncedStores(
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
      allFromSyncedStores(namespace: coreNamespace, resource: addressesResource).count, 1)
    let updatedRows = allFromSyncedStores(
      namespace: coreNamespace, resource: addressesResource)
    guard case .dictionary(let updatedAddress) = try updatedRows[0].decoded() else {
      return XCTFail("expected address after second save")
    }
    XCTAssertEqual(updatedAddress["instructions"], .string("Updated instructions"))
  }

  func testDraftModeUpdateWritesChangesIntoCreateDraft() throws {
    let marketplaceNamespace = MarketplaceTestFixture.serviceId
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
        .update(
          service: marketplaceNamespace, resource: itemsResource, mode: .draft, filter: [:],
          changes: .literal(["transfer_options.pickup.address_id": "\"some-address-uuid\""]))
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
    let marketplaceNamespace = MarketplaceTestFixture.serviceId
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
        .update(
          service: marketplaceNamespace, resource: itemsResource, mode: .store,
          filter: ["id": "\(itemsResource).id"],
          changes: .literal(["transfer_options.pickup.address_id": "\"some-address-uuid\""]))
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
    let marketplaceNamespace = MarketplaceTestFixture.serviceId
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
        .update(
          service: marketplaceNamespace, resource: itemsResource, mode: .draft, filter: [:],
          changes: .literal(["title": "\"patched\""]))
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
    let marketplaceNamespace = MarketplaceTestFixture.serviceId
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
        .update(
          service: marketplaceNamespace, resource: itemsResource, mode: .store,
          filter: ["id": "\"\(itemId)\""], changes: .literal(["title": "\"Archived title\""]))
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
    let marketplaceNamespace = MarketplaceTestFixture.serviceId
    let itemsResource = MarketplaceTestFixture.itemsResourceId
    let addressesResource = "addresses"
    let flowId = "create-flow"
    let scopeId = EVYDraft.createMergeScopeId(flowId: flowId, entityKey: itemsResource)

    deleteFromSyncedStores(namespace: coreNamespace, resource: addressesResource)
    try? EVY.publicStore.deleteAll(namespace: marketplaceNamespace, resource: itemsResource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      deleteFromSyncedStores(namespace: coreNamespace, resource: addressesResource)
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

    let addresses = allFromSyncedStores(
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
      allFromSyncedStores(namespace: coreNamespace, resource: addressesResource).count, 1)
    let updatedRows = allFromSyncedStores(
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

  func testResolveInlineCreateDataMapsLiterals() throws {
    let namespace = MarketplaceTestFixture.serviceId
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
        .create(
          service: namespace, resource: resource,
          mode: .inline(data: [
            "fk": "item-1", "service": "\"svc-1\"", "closedAt": "null", "verified": "true",
            "data": "{type: pickup, time: 2026-06-03T09:00:00}",
          ]), idDestination: nil)
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
    XCTAssertEqual(values["closedAt"], .null)
    XCTAssertEqual(values["verified"], .bool(true))
    XCTAssertEqual(
      values["data"],
      .dictionary([
        "type": .string("pickup"),
        "time": .string("2026-06-03T09:00:00"),
      ]))
    // Millisecond precision: `createdAt` orders records against each other, and `sort`
    // compares it as a string, so two writes in the same second must not tie.
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    XCTAssertEqual(values["createdAt"], .string(fractional.string(from: pinnedDate)))
  }

  func testInlineCreateDataKeepsExplicitCreatedAt() throws {
    let namespace = MarketplaceTestFixture.serviceId
    let resource = "created-at-create-actions"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }

    let action = rowAction(
      true:
        .create(
          service: namespace, resource: resource,
          mode: .inline(data: ["fk": "item-1", "createdAt": "\"2026-06-01T00:00:00Z\""]),
          idDestination: nil)
    )
    EVYActionRunner.run(actions: [action]) { _ in }

    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected inline create payload dictionary")
    }
    XCTAssertEqual(values["createdAt"], .string("2026-06-01T00:00:00Z"))
  }

  // MARK: - Bare ids in inline payload values

  /// Seeds a record under `key` so `{key}` resolves to it, the way a resource id
  /// bound by a query param does. Cleaned up by `inlineCreatePayload`'s caller via
  /// `seededBindingKeys`.
  private func seedRecordBinding(key: String, id: String, extra: [String: EVYJson] = [:]) throws {
    var record = extra
    record["id"] = .string(id)
    let encoded = try JSONEncoder().encode(EVYJson.dictionary(record))
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.local, resource: key)
    try EVY.publicStore.create(
      namespace: EVYNamespace.local,
      resource: key,
      id: EVYNamespace.singletonId,
      value: encoded
    )
    seededBindingKeys.append(key)
  }

  private func seedScalarBinding(key: String, value: EVYJson) throws {
    let encoded = try JSONEncoder().encode(value)
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.local, resource: key)
    try EVY.publicStore.create(
      namespace: EVYNamespace.local, resource: key,
      id: EVYNamespace.singletonId, value: encoded)
    seededBindingKeys.append(key)
  }

  /// Runs an inline create into a scratch resource of its own and returns the payload
  /// that landed in the store, cleaning up everything it and `seed*Binding` created.
  private func inlineCreatePayload(_ data: [String: String]) throws -> [String: EVYJson] {
    let namespace = MarketplaceTestFixture.serviceId
    let resource = uniqueKey("inline-create")
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      for key in seededBindingKeys {
        try? EVY.publicStore.deleteAll(namespace: EVYNamespace.local, resource: key)
      }
      seededBindingKeys = []
    }

    let action = rowAction(
      true: .create(
        service: namespace, resource: resource,
        mode: .inline(data: data), idDestination: nil)
    )
    EVYActionRunner.run(actions: [action]) { _ in }

    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      throw EVYError.invalidData(context: "Expected inline create payload dictionary")
    }
    return values
  }

  /// A resource id is also a binding key, so resolving it would hand back that
  /// resource's data. It cannot be scalarised to the resolved record's id either -
  /// the record bound under a resource key is a record, whose id is a different
  /// uuid - so the token itself is the only correct value.
  func testInlineCreateKeepsBareResourceIdAsTheIdItself() throws {
    // A resource id of this test's own, so a cache scope another test left behind
    // cannot resolve the key out from under it.
    let resourceId = UUID().uuidString.lowercased()
    let recordId = UUID().uuidString.lowercased()
    let previousScopeId = EVY.activeCacheScopeId
    EVY.activeCacheScopeId = nil
    defer { EVY.activeCacheScopeId = previousScopeId }
    try seedRecordBinding(key: resourceId, id: recordId, extra: ["title": .string("Fridge")])

    let values = try inlineCreatePayload([
      "resource": resourceId, "fk": "\(resourceId).id",
    ])

    XCTAssertEqual(values["resource"], .string(resourceId))
    // The property-path form still reads the bound record, and its id is a
    // different uuid - which is exactly why the bare form must not be coerced.
    XCTAssertEqual(values["fk"], .string(recordId))
    XCTAssertNotEqual(values["resource"], values["fk"])
  }

  func testInlineCreateKeepsBareUuidThatResolvesToNothing() throws {
    let unboundId = UUID().uuidString.lowercased()

    let values = try inlineCreatePayload(["service": unboundId])

    XCTAssertEqual(values["service"], .string(unboundId))
  }

  func testInlineCreateStillResolvesNonUuidScalarBindings() throws {
    let scalarKey = uniqueKey("timeslot")
    try seedScalarBinding(key: scalarKey, value: .string("2026-06-03T09:00:00"))

    let values = try inlineCreatePayload(["time": scalarKey])

    XCTAssertEqual(values["time"], .string("2026-06-03T09:00:00"))
  }

  /// The rule is scoped to uuid-shaped tokens so it cannot swallow a value that
  /// deliberately embeds a resolved object.
  func testInlineCreateStillEmbedsObjectsForNonUuidBindings() throws {
    let objectKey = uniqueKey("price")
    let recordId = UUID().uuidString.lowercased()
    try seedRecordBinding(key: objectKey, id: recordId, extra: ["currency": .string("AUD")])

    let values = try inlineCreatePayload(["price": objectKey])

    XCTAssertEqual(
      values["price"],
      .dictionary(["id": .string(recordId), "currency": .string("AUD")]))
  }

  func testInlineCreateOmitsUnresolvedDatumKeysFromPayload() throws {
    let pickupDatum = EVYTestMessageFixtures.message(
      id: UUID().uuidString,
      fk: UUID().uuidString,
      type: "pickup",
      value: "pending",
      time: "2026-06-03T09:00:00"
    )
    let resolved = EVYPlainTextResolution.resolveValues(
      [
        "message_id": "$datum.id",
        "value": "accept",
        "type": "$datum.data.type",
        "time": "$datum.data.time",
        "postalcode": "$datum.data.postalcode",
      ],
      datum: pickupDatum,
      omitUnresolvedDatumKeys: true
    )

    XCTAssertEqual(resolved["value"], .string("accept"))
    XCTAssertEqual(resolved["type"], .string("pickup"))
    XCTAssertEqual(resolved["time"], .string("2026-06-03T09:00:00"))
    XCTAssertNil(resolved["postalcode"])
  }

  func testUpdateChangesOmitUnresolvedDatumKeys() throws {
    let namespace = "test"
    let resource = "omit-datum-changes"
    let recordId = UUID().uuidString
    deleteFromSyncedStores(namespace: namespace, resource: resource)
    defer { deleteFromSyncedStores(namespace: namespace, resource: resource) }

    try EVY.applySyncedValue(
      namespace: namespace, resource: resource,
      value: .array([
        .dictionary([
          "id": .string(recordId),
          "label": .string("pickup"),
        ])
      ]))

    let datum = EVYJson.dictionary([
      "id": .string(recordId),
      "label": .string("pickup"),
    ])
    let action = rowAction(
      true: .update(
        service: namespace, resource: resource, mode: .store,
        filter: ["id": "$datum.id"],
        changes: .literal([
          "label": "$datum.label",
          "missing": "$datum.doesNotExist",
        ]))
    )
    EVYActionRunner.run(actions: [action], datum: datum) { _ in }

    let rows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let updated = try XCTUnwrap(rows.first?.decoded())
    guard case .dictionary(let values) = updated else {
      return XCTFail("Expected updated dictionary")
    }
    XCTAssertEqual(values["label"], .string("pickup"))
    XCTAssertNil(values["missing"])
  }

  func testFilterMapKeepsUnresolvedDatumAsLiteral() throws {
    let resolved = EVYPlainTextResolution.resolveValues(
      ["postalcode": "$datum.data.postalcode"],
      datum: EVYTestMessageFixtures.message(
        id: UUID().uuidString, type: "pickup", value: "pending", time: "2026-06-03T09:00:00"),
      omitUnresolvedDatumKeys: false
    )
    XCTAssertEqual(resolved["postalcode"], .string("$datum.data.postalcode"))
  }

  /// A store-mode update is scoped to the datum's own record, and a filter term that fails
  /// makes the whole thing a no-op.
  ///
  /// Deliberately on a scratch resource rather than on messages. A message is write-once now -
  /// it has no mutable field left to exercise - so using one here would test update mechanics
  /// against a shape the contract no longer permits.
  func testUpdateActionUpdatesOnlyTheMatchingRecordForDatum() throws {
    let namespace = "test"
    let resource = "store-update-actions"
    let matchingId = UUID().uuidString
    let otherOpenId = UUID().uuidString
    let alreadyClosedId = UUID().uuidString
    let closedAt = "2026-06-01T00:00:00Z"
    deleteFromSyncedStores(namespace: namespace, resource: resource)
    defer { deleteFromSyncedStores(namespace: namespace, resource: resource) }

    let records = EVYJson.array([
      .dictionary(["id": .string(matchingId), "closedAt": .null]),
      .dictionary(["id": .string(otherOpenId), "closedAt": .null]),
      .dictionary(["id": .string(alreadyClosedId), "closedAt": .string(closedAt)]),
    ])
    try EVY.applySyncedValue(namespace: namespace, resource: resource, value: records)

    let closeAction = rowAction(
      true:
        .update(
          service: namespace, resource: resource, mode: .store,
          filter: ["id": "$datum.id", "closedAt": "null"],
          changes: .literal(["closedAt": "now()"]))
    )

    EVYActionRunner.run(
      actions: [closeAction],
      datum: EVYJson.dictionary(["id": .string(matchingId)])
    ) { _ in }

    var closed = try closedAtByRecordId(namespace: namespace, resource: resource)
    XCTAssertNotNil(closed[matchingId], "the datum's own record is updated")
    XCTAssertNil(closed[otherOpenId], "another open record is left alone")
    XCTAssertEqual(closed[alreadyClosedId], closedAt)

    EVYActionRunner.run(
      actions: [closeAction],
      datum: EVYJson.dictionary(["id": .string(alreadyClosedId)])
    ) { _ in }

    closed = try closedAtByRecordId(namespace: namespace, resource: resource)
    XCTAssertEqual(
      closed[alreadyClosedId], closedAt,
      "an already-closed record no longer matches the filter")
  }

  private func allFromSyncedStores(namespace: String, resource: String) -> [EVYData] {
    EVY.syncedStores().flatMap {
      (try? $0.getAll(namespace: namespace, resource: resource)) ?? []
    }
  }

  private func deleteFromSyncedStores(namespace: String, resource: String) {
    for store in EVY.syncedStores() {
      try? store.deleteAll(namespace: namespace, resource: resource)
    }
  }

  /// Close-out timestamps by record id. A record with no `closedAt`, or an explicit null, is
  /// absent from the result - so a missing key reads as "still open".
  private func closedAtByRecordId(
    namespace: String,
    resource: String
  ) throws -> [String: String] {
    let rows = EVY.syncedStores().flatMap {
      (try? $0.getAll(namespace: namespace, resource: resource)) ?? []
    }
    return Dictionary(
      uniqueKeysWithValues: rows.compactMap { row -> (String, String)? in
        guard let decoded = try? row.decoded(),
          case .dictionary(let values) = decoded,
          case .string(let id) = values["id"],
          case .string(let closedAt) = values["closedAt"],
          !closedAt.isEmpty
        else { return nil }
        return (id, closedAt)
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
        .create(
          service: namespace, resource: resource,
          mode: .inline(data: [
            "fk": "$datum.id", "data": "{type: pickup, time: selected_pickup_timeslot}",
          ]), idDestination: nil)
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
    let action = rowAction(true: .show(rowId: "child-row"))
    EVYActionRunner.run(actions: [action], show: { rowId in shownRowId = rowId }) { _ in }
    XCTAssertEqual(shownRowId, "child-row")
  }

  func testShowActionThrowingShowCallbackPostsError() {
    let action = rowAction(true: .show(rowId: "missing-row"))
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
    let action = rowAction(condition: "{false}", true: nil, false: .show(rowId: "sheet-row"))
    EVYActionRunner.run(actions: [action], show: { rowId in shownRowId = rowId }) { _ in }
    XCTAssertEqual(shownRowId, "sheet-row")
  }

  func testSelectDispatchesBareDatum() {
    let datum = EVYJson.dictionary([
      "dateTimeISO": .string("2026-06-03T11:00:00"),
      "label": .string("11:00"),
    ])
    var received: EVYRowActionOperation?
    let selectAction = rowAction(true: .select(value: "$datum"))
    let closeAction = rowAction(true: .close)
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
      actions: [rowAction(true: .select(value: "$datum"))],
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
      actions: [rowAction(true: .select(value: "$datum.dateTimeISO"))],
      datum: datum,
      rowOperation: { received = $0 }
    ) { _ in }
    assertSelectValue(received, equals: .string("2026-06-03T11:00:00"))
  }

  func testSelectPassesQuotedLiteral() {
    var received: EVYRowActionOperation?
    EVYActionRunner.run(
      actions: [rowAction(true: .select(value: "\"literal\""))],
      rowOperation: { received = $0 }
    ) { _ in }
    assertSelectValue(received, equals: .string("literal"))
  }

  func testRowPhotoOperationsDispatchesAndContinues() {
    let cases: [(EVYActionInvocation, (EVYRowActionOperation) -> Bool)] = [
      (
        .deletePhoto,
        {
          if case .deletePhoto = $0 { return true }
          return false
        }
      ),
      (
        .selectPhoto,
        {
          if case .selectPhoto = $0 { return true }
          return false
        }
      ),
      (
        .expandPhoto,
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
    let closeAction = rowAction(true: .close)
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
        actions: [rowAction(true: .select(value: "$datum")), rowAction(true: .close)],
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
      actions: [rowAction(true: .expandText(rowId: "text-expand-row")), rowAction(true: .close)]
    ) { receivedOps.append($0) }

    XCTAssertEqual(postedRowId, "text-expand-row")
    XCTAssertEqual(receivedOps, [.close])
  }

  func testNavigateWithBraceFunction() {
    var received: ActionOperation?
    let action = rowAction(true: .navigate(flowId: "flow-1", pageId: "page-2", query: [:]))
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
    let action = rowAction(
      true: .navigate(flowId: "flow-1", pageId: "page-2", query: ["items": "[id-1, id-2]"]))
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate, got \(String(describing: received))")
      return
    }
    XCTAssertEqual(route.flowId, "flow-1")
    XCTAssertEqual(route.pageId, "page-2")
    XCTAssertEqual(route.query["items"], ["id-1", "id-2"])
  }

  func testHighlightRequiredFormatsFieldLabel() {
    var received: ActionOperation?
    let action = rowAction(true: .highlightRequired(field: "unit_price"))
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
      true: .highlightRequired(field: "\(MarketplaceTestFixture.itemsResourceId).pickup_selection")
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .highlightRequired(let label) = received else {
      XCTFail("Expected highlightRequired")
      return
    }
    XCTAssertEqual(label, "Pickup Selection")
  }

  func testNavigateWithDatumResolvesId() {
    var received: ActionOperation?
    let datum = EVYJson.dictionary([
      "id": .string("resolved-uuid"),
      "title": .string("Test Item"),
    ])
    let action = rowAction(
      true: .navigate(flowId: "flowX", pageId: "pageY", query: ["items": "$datum.id"]))
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
    let action = rowAction(
      true: .navigate(flowId: "flowX", pageId: "pageY", query: ["items": "[a]", "kind": "item"]))
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
    let action = rowAction(
      true: .navigate(
        flowId: "flowX", pageId: "pageY", query: ["items": "[]", "kind": "item", "empty": ""]))
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertNil(route.query["items"])
    XCTAssertEqual(route.query["kind"], ["item"])
    XCTAssertNil(route.query["empty"])
  }

  func testNavigateWithUnclosedQueryArrayPostsError() {
    var received: ActionOperation?
    let action = UI_RowAction(
      condition: "", false: .empty,
      true: .invocation(
        .navigate(flowId: "flowX", pageId: "pageY", query: ["items": "[a"])))
    let errors = capturedErrors {
      EVYActionRunner.run(actions: [action]) { received = $0 }
    }
    XCTAssertFalse(errors.isEmpty)
    XCTAssertNil(received)
  }

  func testNavigateWithoutDatumKeepsDatumExpression() {
    var received: ActionOperation?
    let action = rowAction(
      true: .navigate(flowId: "flowX", pageId: "pageY", query: ["items": "$datum.id"]))
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.query["items"], ["$datum.id"])
  }

  func testFalseBranchWithoutCreateRunsHighlightRequired() {
    let messagesResourceId = EVYCoreResource.messages.rawValue
    let itemResourceId = MarketplaceTestFixture.itemsResourceId
    var received: ActionOperation?
    let action = rowAction(
      condition: "{length(shipping_address.postcode) > 0}",
      true:
        .create(
          service: EVYNamespace.evy, resource: messagesResourceId,
          mode: .inline(data: [
            "fk": "\(itemResourceId).id",
            "data": "{type: shipping, value: pending, postalcode: shipping_address.postcode}",
          ]), idDestination: nil),
      false: .highlightRequired(field: "postcode")
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertEqual(received, .highlightRequired("Postcode"))
  }

  func testCreateActionRunsImmediately() throws {
    let namespace = EVYNamespace.evy
    let resource = EVYCoreResource.messages.rawValue
    let itemResourceId = MarketplaceTestFixture.itemsResourceId
    let itemId = UUID().uuidString
    let itemTitle = "Pickup Item Title"
    deleteFromSyncedStores(namespace: namespace, resource: resource)
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: itemResourceId)
    defer {
      deleteFromSyncedStores(namespace: namespace, resource: resource)
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
        .create(
          service: namespace, resource: resource,
          mode: .inline(data: [
            "fk": "\(itemResourceId).id",
            "data": "{type: pickup, value: pending, time: 2026-06-03T09:00:00}",
          ]), idDestination: nil)
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }

    XCTAssertNil(received)
    let createdRows = allFromSyncedStores(namespace: namespace, resource: resource)
    XCTAssertEqual(createdRows.count, 1)
  }

  func testDatumRowFormatterResolvesDatumReferencesInActions() throws {
    let navigateAction: EVYActionInvocation = .navigate(
      flowId: "flowX", pageId: "pageY", query: ["id": "$datum.id"])
    let updateAction: EVYActionInvocation = .create(
      service: EVY_CORE_SERVICE,
      resource: EVYCoreResource.messages.rawValue,
      mode: .inline(data: [
        "fk": "$datum.fk",
        "data": "{message_id: $datum.id, value: cancel, type: $datum.data.type}",
      ]),
      idDestination: nil)
    let row = try decodeRow(
      content: """
        {
          "title": "{$datum.title}",
          "subtitle": "{$datum.data.value}"
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
      "data": .dictionary(["value": .string("pending")]),
    ])

    let formattedRow = try formatter.formattedResult(datum: datum).row

    XCTAssertEqual(formattedRow.id, row.id)
    XCTAssertEqual(formattedRow.title, "Resolved Title")
    XCTAssertEqual(formattedRow.actions.tap.first?.true, branch(navigateAction))
    XCTAssertEqual(formattedRow.actions.swipeLeft.first?.true, branch(updateAction))
  }

  func testSwipeLeftUpdateActionRunsAgainstItsOwnFormattedSearchResult() throws {
    let namespace = "test"
    let resource = "swipe-left-formatted-results"
    let openId = UUID().uuidString
    deleteFromSyncedStores(namespace: namespace, resource: resource)
    defer { deleteFromSyncedStores(namespace: namespace, resource: resource) }

    let record = EVYJson.dictionary([
      "id": .string(openId),
      "label": .string("pickup"),
      "closedAt": .null,
    ])
    try EVY.applySyncedValue(
      namespace: namespace, resource: resource, value: .array([record]))

    let template = try decodeRow(
      content: """
        {
          "title": "{$datum.label} request",
          "subtitle": ""
        }
        """,
      actions: UI_RowActions(
        swipeLeft: [
          rowAction(
            true:
              .update(
                service: namespace, resource: resource, mode: .store,
                filter: ["id": "$datum.id", "closedAt": "null"],
                changes: .literal(["closedAt": "now()"]))
          )
        ]
      )
    )
    let results = EVYSearchResult.makeResults(
      from: .array([record]),
      resultTemplate: template,
      scopeId: nil
    )
    let result = try XCTUnwrap(results.first)

    EVYActionRunner.run(
      actions: result.displayRow.actions.swipeLeft,
      datum: result.datum
    ) { _ in }

    let closed = try closedAtByRecordId(namespace: namespace, resource: resource)
    XCTAssertNotNil(closed[openId])
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
