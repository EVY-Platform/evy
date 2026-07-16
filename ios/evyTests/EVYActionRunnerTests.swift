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
    try EVY.updateValue("Flow Submitted Title", at: "{title}", scopeId: scopeId)

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
    try EVY.updateValue("Chained Title", at: "{title}", scopeId: scopeId)

    var receivedOperations: [ActionOperation] = []
    let createAction = rowAction(true: "{create(\(namespace),\(resource))}")
    let closeAction = rowAction(true: "{close()}")
    EVYActionRunner.run(actions: [createAction, closeAction]) { receivedOperations.append($0) }

    XCTAssertEqual(receivedOperations, [.close])
    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(createdRows.count, 1)
  }

  func testChainHaltsWhenActionThrows() {
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil
    )
    let throwingAction = rowAction(true: "{create(onlyNamespace)}")
    let closeAction = rowAction(true: "{close()}")
    var received: ActionOperation?
    EVYActionRunner.run(actions: [throwingAction, closeAction]) { received = $0 }
    wait(for: [expectation], timeout: 2)
    XCTAssertNil(received, "close should not run once an earlier action throws")
  }

  func testCreateActionParserParsesInlineData() {
    let action = EVYActionParser.createAction(
      from: "{create(ns,res,{type: pickup, item_id: abc.id, time: selected_pickup_timeslot})}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(
      action?.data,
      ["type": "pickup", "item_id": "abc.id", "time": "selected_pickup_timeslot"]
    )
  }

  func testCreateActionParserKeepsTwoArgumentDataNil() {
    let action = EVYActionParser.createAction(from: "{create(ns,res)}")

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertNil(action?.data)
  }

  func testCreateActionParserRejectsMalformedInlineData() {
    XCTAssertNil(EVYActionParser.createAction(from: "{create(ns,res,{type: pickup, item_id})}"))
  }

  func testUpdateActionParserParsesFilterAndChanges() {
    let action = EVYActionParser.updateAction(
      from:
        "{update(ns,res,{item_id: abc.id, archived: false},{archived: true})}"
    )

    XCTAssertEqual(action?.namespace, "ns")
    XCTAssertEqual(action?.resource, "res")
    XCTAssertEqual(action?.filter, ["item_id": "abc.id", "archived": "false"])
    XCTAssertEqual(action?.changes, ["archived": "true"])
  }

  func testUpdateActionParserRejectsMissingFilterOrChanges() {
    XCTAssertNil(EVYActionParser.updateAction(from: "{update(ns,res)}"))
    XCTAssertNil(EVYActionParser.updateAction(from: "{update(ns,res,{id: abc})}"))
    XCTAssertNil(
      EVYActionParser.updateAction(from: "{update(ns,res,{}, {archived: true})}"))
    XCTAssertNil(
      EVYActionParser.updateAction(from: "{update(ns,res,{item_id: abc},{})}"))
  }

  func testResolveInlineCreateDataMapsBooleanLiterals() throws {
    let namespace = EVYNamespace.marketplace
    let resource = "boolean-create-actions"
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }

    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{type: pickup, item_id: item-1, time: 2026-06-03T09:00:00, archived: false})}"
    )
    var received: ActionOperation?
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertNil(received)

    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected inline create payload dictionary")
    }
    XCTAssertEqual(values["archived"], .bool(false))
  }

  func testUpdateActionArchivesOnlyMatchingActiveRequest() throws {
    let namespace = EVYNamespace.marketplace
    let resource = MarketplaceTestFixture.requestsResourceId
    let itemId = UUID().uuidString
    let archivedRequestId = UUID().uuidString
    let activeRequestId = UUID().uuidString
    let otherActiveRequestId = UUID().uuidString
    try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }

    let requests = EVYJson.array([
      .dictionary([
        "id": .string(archivedRequestId),
        "item_id": .string(itemId),
        "archived": .bool(true),
        "type": .string("pickup"),
        "time": .string("2026-06-03T09:00:00"),
      ]),
      .dictionary([
        "id": .string(activeRequestId),
        "item_id": .string(itemId),
        "archived": .bool(false),
        "type": .string("pickup"),
        "time": .string("2026-06-03T10:00:00"),
      ]),
      .dictionary([
        "id": .string(otherActiveRequestId),
        "item_id": .string(UUID().uuidString),
        "archived": .bool(false),
        "type": .string("pickup"),
        "time": .string("2026-06-03T11:00:00"),
      ]),
    ])
    try EVY.publicStore.applySyncedValue(namespace: namespace, resource: resource, value: requests)

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

    let cancelAction = rowAction(
      true:
        "{update(\(namespace),\(resource),{item_id: \(itemKey).id, archived: false},{archived: true})}"
    )
    var received: ActionOperation?
    EVYActionRunner.run(actions: [cancelAction]) { received = $0 }
    XCTAssertNil(received)

    XCTAssertTrue(
      receivedKeys.contains(resource),
      "Update should post a value-change notification for the requests resource")

    let updatedRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let archivedById = Dictionary(
      uniqueKeysWithValues: updatedRows.compactMap { row -> (String, EVYJson)? in
        guard let decoded = try? row.decoded(),
          case .dictionary(let values) = decoded,
          case .string(let id) = values["id"]
        else { return nil }
        return (id, values["archived"] ?? .null)
      })

    XCTAssertEqual(archivedById[archivedRequestId], .bool(true))
    XCTAssertEqual(archivedById[activeRequestId], .bool(true))
    XCTAssertEqual(archivedById[otherActiveRequestId], .bool(false))
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
      at: "{selected_pickup_timeslot}",
      scopeId: scopeId
    )

    let datum = EVYJson.dictionary(["id": .string("item-id")])
    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{type: pickup, item_id: $datum.id, time: selected_pickup_timeslot})}"
    )
    var receivedNavigation: ActionOperation?

    EVYActionRunner.run(actions: [action], datum: datum) { receivedNavigation = $0 }

    XCTAssertNil(receivedNavigation)
    let createdRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    let createdPayload = try XCTUnwrap(createdRows.first?.decoded())
    guard case .dictionary(let values) = createdPayload else {
      return XCTFail("Expected inline create payload dictionary")
    }
    XCTAssertEqual(values["type"], .string("pickup"))
    XCTAssertEqual(values["item_id"], .string("item-id"))
    XCTAssertEqual(values["time"], .string(selectedTimeslot))
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
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    let action = rowAction(true: "{navigate(flow-1,page-2,notJson)}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    wait(for: [expectation], timeout: 2)
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
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    let action = rowAction(true: "{notARealEvyFunction()}")
    EVYActionRunner.run(actions: [action]) { _ in }
    wait(for: [expectation], timeout: 2)
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
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    let action = rowAction(true: "{navigate(flowX,pageY,{items [a]})}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    wait(for: [expectation], timeout: 2)
    XCTAssertNil(received)
  }

  func testNavigateWithUnclosedQueryArrayPostsError() {
    var received: ActionOperation?
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    let action = rowAction(true: "{navigate(flowX,pageY,{items: [a})}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    wait(for: [expectation], timeout: 2)
    XCTAssertNil(received)
  }

  func testNavigateWithTooManyArgsThrowsError() {
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    let action = rowAction(true: "{navigate(flowX,pageY,{key: val},extra)}")
    EVYActionRunner.run(actions: [action]) { _ in }
    wait(for: [expectation], timeout: 2)
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
    let requestsResourceId = MarketplaceTestFixture.requestsResourceId
    let itemResourceId = MarketplaceTestFixture.itemsResourceId
    var received: ActionOperation?
    let action = rowAction(
      condition: "{length(shipping_address.postcode) > 0}",
      true:
        "{create(\(EVYNamespace.marketplace),\(requestsResourceId),{type: shipping, item_id: \(itemResourceId).id, postalcode: shipping_address.postcode, archived: false})}",
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
        at: "{selected_pickup_timeslot}",
        scopeId: scopeId
      )
    }
    let action = rowAction(
      true:
        "{create(\(namespace),\(resource),{type: pickup, item_id: item-1, time: selected_pickup_timeslot, archived: false})}"
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
    XCTAssertEqual(values["time"], .string(selectedTimeslot))
  }

  func testCreateActionRunsImmediately() throws {
    let namespace = EVYNamespace.marketplace
    let resource = MarketplaceTestFixture.requestsResourceId
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
        "{create(\(namespace),\(resource),{type: pickup, item_id: \(itemResourceId).id, time: 2026-06-03T09:00:00, archived: false})}"
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
