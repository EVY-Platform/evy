//
//  EVYActionRunnerTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYActionRunnerTests: XCTestCase {
  private func rowAction(
    condition: String = "",
    true trueBranch: String,
    false falseBranch: String = ""
  ) -> UI_RowAction {
    UI_RowAction(
      condition: condition,
      false: falseBranch,
      true: trueBranch
    )
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

    EVY.ensureDraftExists(variableName: "title", scopeId: scopeId)
    try EVY.updateValue("Flow Submitted Title", destination: "{title}", scopeId: scopeId)

    var received: ActionOperation?
    let action = rowAction(true: "{create(\(namespace),\(resource))}")
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
    let createAction = rowAction(true: "{create(\(namespace),\(resource))}")
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
      [
        "fk": "abc.id",
        "archivedAt": "null",
        "data": "{type: pickup, time: selected_pickup_timeslot}",
      ]
    )
  }

  func testCreateActionParserKeepsTwoArgumentDataNil() {
    let action = EVYActionParser.createAction(from: "{create(ns,res)}")

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertNil(action?.data)
  }

  func testCreateActionParserRejectsMalformedInlineData() {
    XCTAssertNil(EVYActionParser.createAction(from: "{create(ns,res,{type: pickup, fk})}"))
  }

  func testUpdateActionParserParsesFilterAndChanges() {
    let action = EVYActionParser.updateAction(
      from:
        "{update(ns,res,{fk: abc.id, archivedAt: null},{archivedAt: now()})}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(action?.filter, ["fk": "abc.id", "archivedAt": "null"])
    XCTAssertEqual(action?.changes, ["archivedAt": "now()"])
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

  func testUpdateActionArchivesOnlyMatchingActiveMessage() throws {
    let namespace = EVYNamespace.marketplace
    let resource = MarketplaceTestFixture.messagesResourceId
    let itemId = UUID().uuidString
    let archivedMessageId = UUID().uuidString
    let activeMessageId = UUID().uuidString
    let otherActiveMessageId = UUID().uuidString
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }

    // activeMessageId has archivedAt: null, activeAbsentMessageId omits the key entirely —
    // a null filter must match both
    let activeAbsentMessageId = UUID().uuidString
    let messages = EVYJson.array([
      .dictionary([
        "id": .string(archivedMessageId),
        "fk": .string(itemId),
        "archivedAt": .string("2026-06-02T00:00:00Z"),
        "data": .dictionary([
          "type": .string("pickup"),
          "time": .string("2026-06-03T09:00:00"),
        ]),
      ]),
      .dictionary([
        "id": .string(activeMessageId),
        "fk": .string(itemId),
        "archivedAt": .null,
        "data": .dictionary([
          "type": .string("pickup"),
          "time": .string("2026-06-03T10:00:00"),
        ]),
      ]),
      .dictionary([
        "id": .string(activeAbsentMessageId),
        "fk": .string(itemId),
        "data": .dictionary([
          "type": .string("delivery"),
          "time": .string("2026-06-03T12:00:00"),
        ]),
      ]),
      .dictionary([
        "id": .string(otherActiveMessageId),
        "fk": .string(UUID().uuidString),
        "archivedAt": .null,
        "data": .dictionary([
          "type": .string("pickup"),
          "time": .string("2026-06-03T11:00:00"),
        ]),
      ]),
    ])
    try EVY.publicStore.applySyncedValue(namespace: namespace, resource: resource, value: messages)

    var receivedKeys: [String] = []
    let token = NotificationCenter.default.addObserver(
      forName: .evyValueChanged, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        if let key = notification.object as? String {
          receivedKeys.append(key)
        }
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    let itemKey =
      "evy_action_runner_item_\(UUID().uuidString.replacingOccurrences(of: "-", with: "_"))"
    try EVY.publicStore.create(
      namespace: EVYNamespace.local,
      resource: itemKey,
      id: EVYNamespace.singletonId,
      value: try JSONEncoder().encode(EVYJson.dictionary(["id": .string(itemId)]))
    )

    let pinnedDate = Date(timeIntervalSince1970: 1_780_000_000)
    EVY.nowProvider = { pinnedDate }
    defer { EVY.nowProvider = { Date() } }

    let cancelAction = rowAction(
      true:
        "{update(\(namespace),\(resource),{fk: \(itemKey).id, archivedAt: null},{archivedAt: now()})}"
    )
    var received: ActionOperation?
    EVYActionRunner.run(actions: [cancelAction]) { received = $0 }
    XCTAssertNil(received)

    XCTAssertTrue(
      receivedKeys.contains(resource),
      "Update should post a value-change notification for the messages resource")

    let updatedRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let archivedAtById = Dictionary(
      uniqueKeysWithValues: updatedRows.compactMap { row -> (String, EVYJson)? in
        guard let decoded = try? row.decoded(),
          case .dictionary(let values) = decoded,
          case .string(let id) = values["id"]
        else { return nil }
        return (id, values["archivedAt"] ?? .null)
      })

    let pinnedIso = EVYJson.string(pinnedDate.ISO8601Format())
    XCTAssertEqual(
      archivedAtById[archivedMessageId], .string("2026-06-02T00:00:00Z"),
      "Already-archived message should keep its original timestamp")
    XCTAssertEqual(archivedAtById[activeMessageId], pinnedIso)
    XCTAssertEqual(
      archivedAtById[activeAbsentMessageId], pinnedIso,
      "A null filter should match records missing the key entirely")
    XCTAssertEqual(archivedAtById[otherActiveMessageId], .null)
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

  func testShowActionPresentsChild() throws {
    let row = try makeRowWithChild()
    let childRef = row.child.map(EVYRowRef.inline)
    var shownRef: EVYRowRef?
    let action = rowAction(true: "{show()}")
    EVYActionRunner.run(actions: [action], childRef: childRef, show: { shownRef = $0 }) { _ in }
    XCTAssertEqual(shownRef?.id, "child-row")
  }

  func testShowActionWithoutChildIsNoOp() throws {
    var shownRef: EVYRowRef?
    let action = rowAction(true: "{show()}")
    EVYActionRunner.run(actions: [action], childRef: nil, show: { shownRef = $0 }) { _ in }
    XCTAssertNil(shownRef)
  }

  func testFalseBranchShowActionPresentsChild() throws {
    let row = try makeRowWithChild()
    let childRef = row.child.map(EVYRowRef.inline)
    var shownRef: EVYRowRef?
    let action = rowAction(condition: "{false}", true: "", false: "{show()}")
    EVYActionRunner.run(actions: [action], childRef: childRef, show: { shownRef = $0 }) { _ in }
    XCTAssertEqual(shownRef?.id, "child-row")
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
        "{create(\(EVYNamespace.marketplace),\(messagesResourceId),{fk: \(itemResourceId).id, archivedAt: null, data: {type: shipping, postalcode: shipping_address.postcode}})}",
      false: "{highlight_required(postcode)}"
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertEqual(received, .highlightRequired("Postcode"))
  }

  func testPrepareRunsBeforeChain() throws {
    let namespace = "test"
    let resource = "prepare-create-actions"
    let scopeId = "__test__:prepare-create"
    let selectedTimeslot = "2026-06-03T11:00:00"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = scopeId
    defer {
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    EVY.ensureDraftExists(variableName: "selected_pickup_timeslot", scopeId: scopeId)
    var prepareRan = false
    let prepare = {
      prepareRan = true
      try? EVY.updateValue(
        selectedTimeslot,
        destination: "{selected_pickup_timeslot}",
        scopeId: scopeId
      )
    }
    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{fk: item-1, archivedAt: null, data: {type: pickup, time: selected_pickup_timeslot}})}"
    )
    var received: ActionOperation?
    EVYActionRunner.run(actions: [action], prepare: prepare) { received = $0 }

    XCTAssertTrue(prepareRan)
    XCTAssertNil(received)

    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected inline create payload dictionary")
    }
    XCTAssertEqual(values["data"]?.parseProp(props: ["time"]), .string(selectedTimeslot))
  }

  func testCreateActionRunsImmediately() throws {
    let namespace = EVYNamespace.marketplace
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
    let actionString = "{navigate(flowX,pageY,{id: $datum.id})}"
    let row = try decodeRow(
      content: """
        {
          "title": "{$datum.title}"
        }
        """,
      actions: [rowAction(true: actionString)]
    )
    let formatter = try EVYDatumRowFormatter(template: row)
    let datum = EVYJson.dictionary([
      "id": .string("resolved-uuid"),
      "title": .string("Resolved Title"),
    ])

    let formattedRow = try formatter.formattedResult(datum: datum).row

    XCTAssertEqual(formattedRow.title, "Resolved Title")
    XCTAssertEqual(formattedRow.actions.first?.true, actionString)
  }

  private func makeRowWithChild() throws -> UI_Row {
    try decodeRow(
      content: """
        {
          "title": "",
          "label": "Show child",
          "child": {
            "id": "child-row",
            "type": "Text",
            "source": "",
            "destination": "",
            "title": "Child",
            "text": "Body",
            "actions": [],
            "visible": "true"
          }
        }
        """
    )
  }

  private func makeRowWithoutChild() throws -> UI_Row {
    try decodeRow(
      content: """
        { "title": "", "label": "No child" }
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
    actions: [UI_RowAction] = []
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
