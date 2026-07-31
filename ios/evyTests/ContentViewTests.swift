//
//  ContentViewTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class ContentViewTests: XCTestCase {

  override func setUpWithError() throws {
    try super.setUpWithError()
    try evySeedStandardFormattersForTests()
  }

  override func tearDownWithError() throws {
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    try super.tearDownWithError()
  }

  // MARK: - Store seeding helpers

  private func makeStore() -> EVYDataStore {
    EVYDataStore(name: UUID().uuidString, inMemoryOnly: true)
  }

  private func seedFlow(
    store: EVYDataStore,
    id: String,
    pageIds: [String],
    submits: [String: String]? = nil
  ) throws {
    var json: [String: Any] = [
      "id": id,
      "name": "Test Flow",
      "page_ids": pageIds,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
    ]
    if let submits { json["submits"] = submits }
    let data = try JSONSerialization.data(withJSONObject: json)
    try store.upsert(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.flows.ref,
      id: id,
      value: data
    )
  }

  private func seedPage(
    store: EVYDataStore,
    id: String,
    title: String = "Test Page",
    rowIds: [String],
    footerRowId: String? = nil
  ) throws {
    var json: [String: Any] = [
      "id": id,
      "name": title,
      "title": title,
      "row_ids": rowIds,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
    ]
    if let footerRowId {
      json["footer_row_id"] = footerRowId
    }
    let data = try JSONSerialization.data(withJSONObject: json)
    try store.upsert(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.pages.ref,
      id: id,
      value: data
    )
  }

  private func writeEphemeralValue(
    pageId: String,
    variableName: String,
    value: String
  ) throws {
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: pageId)
    EVY.draftStore.activeScopeId = scopeId
    try EVY.writeRawStringValue(value, to: "{\(variableName)}", scopeId: scopeId)
  }

  private func readEphemeralValue(pageId: String, variableName: String) throws -> EVYJson {
    EVY.draftStore.activeScopeId = EVYDraft.ephemeralScopeId(forPageId: pageId)
    return try EVY.getDataFromText("{\(variableName)}")
  }

  private func seedRow(
    store: EVYDataStore,
    id: String,
    type: String,
    visible: String = "true",
    data rowData: [String: Any] = [:]
  ) throws {
    let json: [String: Any] = [
      "id": id,
      "name": "Test Row",
      "type": type,
      "visible": visible,
      "data": rowData,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
    ]
    let jsonData = try JSONSerialization.data(withJSONObject: json)
    try store.upsert(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.ref,
      id: id,
      value: jsonData
    )
  }

  // MARK: - Navigation tests

  func testNavigatingHomeClearsCreateFlowRoutes() {
    let createRoutes = [
      Route(flowId: "create-flow", pageId: "describe-page"),
      Route(flowId: "create-flow", pageId: "fulfillment-page"),
      Route(flowId: "create-flow", pageId: "payment-page"),
    ]
    let homeRoute = Route(flowId: "home-flow", pageId: "home-page")

    XCTAssertEqual(
      routesAfterNavigating(from: createRoutes, to: homeRoute, homeFlowId: "home-flow"),
      []
    )
  }

  func testNavigatingAwayFromHomeAppendsRoute() {
    let viewRoute = Route(flowId: "view-flow", pageId: "view-page")

    XCTAssertEqual(
      routesAfterNavigating(from: [], to: viewRoute, homeFlowId: "home-flow"),
      [viewRoute]
    )
  }

  func testNavigatingWithinHomeFlowAppendsPageRoute() {
    let detailsRoute = Route(flowId: "home-flow", pageId: "details-page")

    XCTAssertEqual(
      routesAfterNavigating(from: [], to: detailsRoute, homeFlowId: "home-flow"),
      [detailsRoute]
    )
  }

  // MARK: - EVYFlowStore tests

  func testFlowStoreResolvesFirstPageId() throws {
    let store = makeStore()
    let flowId = "first-page-flow"
    let pageId = "first-page"
    let rowId = "text-row"

    try seedFlow(store: store, id: flowId, pageIds: [pageId])
    try seedPage(store: store, id: pageId, rowIds: [rowId])
    try seedRow(
      store: store, id: rowId, type: "text",
      data: ["source": "", "title": "Hello", "text": "World", "actions": [:]])

    let firstPageId = EVYFlowStore.firstPageId(inFlowId: flowId, from: store)
    XCTAssertEqual(firstPageId, pageId)

    let storedPage = EVYPageStore.page(id: pageId, from: store)
    XCTAssertEqual(storedPage?.row_ids.count, 1)
    XCTAssertEqual(storedPage?.row_ids.first, rowId)
  }

  func testFlowStoreResolvesSpecificRoutePage() throws {
    let store = makeStore()
    let flowId = "multi-page-flow"
    let pageId1 = "page-one"
    let pageId2 = "page-two"

    try seedFlow(store: store, id: flowId, pageIds: [pageId1, pageId2])
    try seedPage(store: store, id: pageId1, rowIds: [])
    try seedPage(store: store, id: pageId2, rowIds: [])

    XCTAssertNotNil(EVYFlowStore.pageId(flowId: flowId, pageId: pageId2, from: store))
    XCTAssertNil(EVYFlowStore.pageId(flowId: flowId, pageId: "unknown-page", from: store))
  }

  // MARK: - Ephemeral drafts

  func testPageIdsForFlowReturnsAllPages() throws {
    let store = makeStore()
    let pageIds = ["page-one", "page-two"]

    try seedFlow(store: store, id: "multi-page-flow", pageIds: pageIds)

    XCTAssertEqual(EVYFlowStore.pageIds(inFlowId: "multi-page-flow", from: store), pageIds)
    XCTAssertEqual(EVYFlowStore.pageIds(inFlowId: "missing-flow", from: store), [])
  }

  func testResetEphemeralDraftsClearsAllFlowPages() throws {
    let store = makeStore()
    let flowId = "flow-with-ephemeral-pages"
    let otherFlowId = "other-flow"
    let pageOneId = "ephemeral-page-one"
    let pageTwoId = "ephemeral-page-two"
    let otherPageId = "other-ephemeral-page"

    try seedFlow(store: store, id: flowId, pageIds: [pageOneId, pageTwoId])
    try seedFlow(store: store, id: otherFlowId, pageIds: [otherPageId])
    try writeEphemeralValue(pageId: pageOneId, variableName: "pageOne.title", value: "One")
    try writeEphemeralValue(pageId: pageTwoId, variableName: "pageTwo.title", value: "Two")
    try writeEphemeralValue(pageId: otherPageId, variableName: "other.title", value: "Other")

    EVY.resetEphemeralDrafts(forFlowId: flowId, from: store)

    XCTAssertNil(try? readEphemeralValue(pageId: pageOneId, variableName: "pageOne.title"))
    XCTAssertNil(try? readEphemeralValue(pageId: pageTwoId, variableName: "pageTwo.title"))
    XCTAssertEqual(
      try readEphemeralValue(pageId: otherPageId, variableName: "other.title"),
      .string("Other")
    )
  }

  func testRowStoreExposesChildRowIdForSearch() throws {
    let store = makeStore()
    let parentId = "parent-row"
    let childId = "child-row"

    try seedRow(
      store: store, id: parentId, type: "search",
      data: [
        "source": "{items}", "destination": "{query}", "title": "", "actions": [:],
        "child_row_id": childId,
      ])
    try seedRow(
      store: store, id: childId, type: "text",
      data: ["source": "", "title": "Child title", "text": "Body", "actions": [:]])

    let storedParent = try XCTUnwrap(EVYRowStore.row(id: parentId, from: store))
    XCTAssertEqual(storedParent.child_row_id, childId)

    let storedChild = try XCTUnwrap(EVYRowStore.row(id: childId, from: store))
    XCTAssertEqual(storedChild.id, childId)
    XCTAssertNil(storedChild.child_row_id)
  }

  func testRowStoreExposesSheetRowId() throws {
    let store = makeStore()
    let parentId = "parent-row"
    let sheetId = "sheet-row"

    try seedRow(
      store: store, id: parentId, type: "button",
      data: [
        "source": "", "title": "", "label": "Parent", "actions": [:],
        "sheet_row_id": sheetId,
      ])
    try seedRow(
      store: store, id: sheetId, type: "text",
      data: ["source": "", "title": "Sheet title", "text": "Body", "actions": [:]])

    let storedParent = try XCTUnwrap(EVYRowStore.row(id: parentId, from: store))
    XCTAssertEqual(storedParent.sheet_row_id, sheetId)
    XCTAssertNil(storedParent.child_row_id)
  }

  func testSearchRowStoresChildAndSheetIndependently() throws {
    let store = makeStore()
    let searchId = "search-row"
    let childId = "search-child"
    let sheetId = "search-sheet"

    try seedRow(
      store: store, id: searchId, type: "search",
      data: [
        "source": "{items}", "destination": "{query}", "title": "", "actions": [:],
        "child_row_id": childId,
        "sheet_row_id": sheetId,
      ])

    let storedSearch = try XCTUnwrap(EVYRowStore.row(id: searchId, from: store))
    XCTAssertEqual(storedSearch.child_row_id, childId)
    XCTAssertEqual(storedSearch.sheet_row_id, sheetId)
  }

  func testRowStoreExposesChildrenRowIds() throws {
    let store = makeStore()
    let containerId = "container-row"
    let childOneId = "child-one"
    let childTwoId = "child-two"

    try seedRow(
      store: store, id: containerId, type: "horizontal_container",
      data: [
        "source": "", "title": "", "actions": [:],
        "children_row_ids": [childOneId, childTwoId],
      ])

    let storedContainer = try XCTUnwrap(EVYRowStore.row(id: containerId, from: store))
    XCTAssertEqual(storedContainer.children_row_ids, [childOneId, childTwoId])
  }

  func testWalkerVisitsRowsInOrder() throws {
    let store = makeStore()
    let pageId = "walk-page"
    let rowOneId = "walk-row-one"
    let rowTwoId = "walk-row-two"

    try seedPage(store: store, id: pageId, rowIds: [rowOneId, rowTwoId])
    try seedRow(
      store: store, id: rowOneId, type: "text",
      data: ["source": "", "title": "One", "actions": [:]])
    try seedRow(
      store: store, id: rowTwoId, type: "text",
      data: ["source": "", "title": "Two", "actions": [:]])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [rowOneId, rowTwoId])
  }

  func testWalkerDescendsIntoChildRowId() throws {
    let store = makeStore()
    let pageId = "child-walk-page"
    let parentId = "child-walk-parent"
    let childId = "child-walk-child"

    try seedPage(store: store, id: pageId, rowIds: [parentId])
    try seedRow(
      store: store, id: parentId, type: "search",
      data: [
        "source": "{items}", "destination": "{query}", "title": "", "actions": [:],
        "child_row_id": childId,
      ])
    try seedRow(
      store: store, id: childId, type: "text",
      data: ["source": "", "title": "Child title", "actions": [:]])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [parentId, childId])
  }

  func testWalkerDescendsIntoSheetRowId() throws {
    let store = makeStore()
    let pageId = "sheet-walk-page"
    let parentId = "sheet-walk-parent"
    let sheetId = "sheet-walk-sheet"

    try seedPage(store: store, id: pageId, rowIds: [parentId])
    try seedRow(
      store: store, id: parentId, type: "button",
      data: [
        "source": "", "title": "", "label": "Parent", "actions": [:],
        "sheet_row_id": sheetId,
      ])
    try seedRow(
      store: store, id: sheetId, type: "text",
      data: ["source": "", "title": "Sheet title", "actions": [:]])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [parentId, sheetId])
  }

  func testWalkerVisitsChildBeforeSheetOnMixedRelationships() throws {
    let store = makeStore()
    let pageId = "mixed-walk-page"
    let searchId = "mixed-search"
    let childId = "mixed-child"
    let sheetId = "mixed-sheet"

    try seedPage(store: store, id: pageId, rowIds: [searchId])
    try seedRow(
      store: store, id: searchId, type: "search",
      data: [
        "source": "{items}", "destination": "{query}", "title": "", "actions": [:],
        "child_row_id": childId,
        "sheet_row_id": sheetId,
      ])
    try seedRow(
      store: store, id: childId, type: "text",
      data: ["source": "", "title": "Child", "actions": [:]])
    try seedRow(
      store: store, id: sheetId, type: "text",
      data: ["source": "", "title": "Sheet", "actions": [:]])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [searchId, childId, sheetId])
  }

  func testWalkerDoesNotRecurseForeverOnSheetCycles() throws {
    let store = makeStore()
    let rowOneId = "sheet-cycle-one"
    let rowTwoId = "sheet-cycle-two"

    try seedPage(store: store, id: "sheet-cycle-page", rowIds: [rowOneId])
    try seedRow(
      store: store, id: rowOneId, type: "button",
      data: [
        "source": "", "title": "", "label": "", "actions": [:],
        "sheet_row_id": rowTwoId,
      ])
    try seedRow(
      store: store, id: rowTwoId, type: "button",
      data: [
        "source": "", "title": "", "label": "", "actions": [:],
        "sheet_row_id": rowOneId,
      ])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: "sheet-cycle-page", from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [rowOneId, rowTwoId])
  }

  func testWalkerDescendsIntoChildrenRowIds() throws {
    let store = makeStore()
    let pageId = "children-walk-page"
    let containerId = "children-walk-container"
    let childOneId = "children-walk-child-one"
    let childTwoId = "children-walk-child-two"

    try seedPage(store: store, id: pageId, rowIds: [containerId])
    try seedRow(
      store: store, id: containerId, type: "horizontal_container",
      data: [
        "source": "", "title": "", "actions": [:],
        "children_row_ids": [childOneId, childTwoId],
      ])
    try seedRow(
      store: store, id: childOneId, type: "text",
      data: ["source": "", "title": "One", "actions": [:]])
    try seedRow(
      store: store, id: childTwoId, type: "text",
      data: ["source": "", "title": "Two", "actions": [:]])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [containerId, childOneId, childTwoId])
  }

  func testWalkerDoesNotRecurseForeverOnRowCycles() throws {
    let store = makeStore()
    let rowOneId = "cycle-row-one"
    let rowTwoId = "cycle-row-two"

    try seedPage(store: store, id: "cycle-page", rowIds: [rowOneId])
    try seedRow(
      store: store, id: rowOneId, type: "search",
      data: [
        "source": "{items}", "destination": "{query}", "title": "", "actions": [:],
        "child_row_id": rowTwoId,
      ])
    try seedRow(
      store: store, id: rowTwoId, type: "search",
      data: [
        "source": "{items}", "destination": "{query}", "title": "", "actions": [:],
        "child_row_id": rowOneId,
      ])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: "cycle-page", from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [rowOneId, rowTwoId])
  }

  func testWalkerVisitsFooterRow() throws {
    let store = makeStore()
    let pageId = "footer-walk-page"
    let rowId = "footer-walk-body-row"
    let footerId = "footer-walk-footer-row"

    try seedPage(store: store, id: pageId, rowIds: [rowId], footerRowId: footerId)
    try seedRow(
      store: store, id: rowId, type: "text",
      data: ["source": "", "title": "Body", "actions": [:]])
    try seedRow(
      store: store, id: footerId, type: "button",
      data: ["source": "", "title": "", "label": "Footer", "actions": [:]])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [rowId, footerId])
  }

  func testUiRowBuildsContentWithoutRelationshipFields() throws {
    let store = makeStore()
    let parentId = "content-parent"
    let childId = "content-child"
    let sheetId = "content-sheet"

    try seedRow(
      store: store, id: parentId, type: "search",
      data: [
        "source": "{items}", "destination": "{query}", "title": "",
        "actions": [:], "child_row_id": childId, "sheet_row_id": sheetId,
      ])

    let storedRow = try XCTUnwrap(EVYRowStore.row(id: parentId, from: store))
    let uiRow = try XCTUnwrap(storedRow.uiRow())

    XCTAssertEqual(uiRow.id, parentId)
    XCTAssertEqual(uiRow.type, .search)
    XCTAssertNil(uiRow.child)
    XCTAssertNil(uiRow.sheet)
    XCTAssertTrue(uiRow.children.isEmpty)
    XCTAssertEqual(storedRow.child_row_id, childId)
    XCTAssertEqual(storedRow.sheet_row_id, sheetId)
  }

  func testRowRefIdTemplateRowResolvesFromStore() throws {
    let store = makeStore()
    let templateId = "template-row"

    try seedRow(
      store: store, id: templateId, type: "text",
      data: ["source": "", "title": "{$datum.title}", "actions": [:]])

    let ref = EVYRowRef.id(templateId)
    let templateRow = ref.templateRow(from: store)
    XCTAssertEqual(templateRow?.id, templateId)
    XCTAssertEqual(templateRow?.type, .text)
  }

  func testRowRefInlineTemplateRowReturnsRowDirectly() {
    let row = UI_Row(id: "inline-row", type: .text, title: "Hello")
    let ref = EVYRowRef.inline(row)
    XCTAssertEqual(ref.templateRow()?.id, "inline-row")
  }

  // MARK: - EVYFlowStore tests

  func testDraftScopeIdForCreateFlowMatchesFlowAndEntityKey() throws {
    let store = makeStore()

    try seedFlow(
      store: store, id: "create-flow", pageIds: ["create-page"],
      submits: [
        "resource": MarketplaceTestFixture.itemsRef
      ])
    try seedPage(
      store: store, id: "create-page", rowIds: [],
      footerRowId: "submit-button")
    try seedRow(
      store: store, id: "submit-button", type: "button",
      data: [
        "source": "", "title": "", "label": "Submit",
        "actions": [
          "tap": [
            [
              "condition": "",
              "false": "",
              "true": "{create(\(MarketplaceTestFixture.itemsRef),submit)}",
            ]
          ]
        ],
      ])

    let route = Route(flowId: "create-flow", pageId: "create-page")
    XCTAssertEqual(
      EVYFlowStore.draftScopeId(for: route, from: store),
      EVYDraft.createMergeScopeId(
        flowId: "create-flow", entityKey: MarketplaceTestFixture.itemsRef)
    )
  }

  // MARK: - submits declaration

  /// Seeds a flow whose only action submits `submitResource`, optionally
  /// declaring `declared` on the flow record.
  private func seedSubmittingFlow(
    store: EVYDataStore,
    flowId: String,
    submitResource: String,
    declared: String? = nil
  ) throws {
    try seedFlow(
      store: store,
      id: flowId,
      pageIds: ["\(flowId)-page"],
      submits: declared.map { ["resource": $0] }
    )
    try seedPage(
      store: store, id: "\(flowId)-page", rowIds: [], footerRowId: "\(flowId)-button")
    try seedRow(
      store: store, id: "\(flowId)-button", type: "button",
      data: [
        "source": "", "title": "", "label": "Submit",
        "actions": [
          "tap": [
            [
              "condition": "",
              "false": "",
              "true": "{create(\(submitResource),submit)}",
            ]
          ]
        ],
      ])
  }

  func testDeclaredSubmitsDrivesDraftScope() throws {
    let store = makeStore()
    try seedSubmittingFlow(
      store: store, flowId: "declared-flow",
      submitResource: MarketplaceTestFixture.itemsRef,
      declared: MarketplaceTestFixture.itemsRef)

    let route = Route(flowId: "declared-flow", pageId: "declared-flow-page")
    XCTAssertEqual(
      EVYFlowStore.draftScopeId(for: route, from: store),
      EVYDraft.createMergeScopeId(
        flowId: "declared-flow", entityKey: MarketplaceTestFixture.itemsRef)
    )
  }

  /// The declaration wins over the actions, so scope no longer depends on
  /// re-parsing every branch in the flow.
  func testDeclaredSubmitsTakesPrecedenceOverActionBranches() throws {
    let store = makeStore()
    try seedSubmittingFlow(
      store: store, flowId: "precedence-flow",
      submitResource: "scraped-resource",
      declared: "declared-resource")

    XCTAssertEqual(
      EVYFlowStore.submissionResources(flowId: "precedence-flow", from: store),
      ["declared-resource"])
  }

  func testFlowWithoutDeclarationHasNoSubmissionResources() throws {
    let store = makeStore()
    try seedSubmittingFlow(
      store: store, flowId: "undeclared-submit-flow",
      submitResource: MarketplaceTestFixture.itemsRef)

    XCTAssertEqual(
      EVYFlowStore.submissionResources(flowId: "undeclared-submit-flow", from: store),
      [])
  }

  func testDraftScopeIdForHomeFlowWithoutCreateUsesBrowseSuffix() throws {
    let store = makeStore()

    try seedFlow(store: store, id: "home-flow", pageIds: ["home-page"])
    try seedPage(store: store, id: "home-page", rowIds: [])

    let route = Route(flowId: "home-flow", pageId: "home-page")
    XCTAssertEqual(
      EVYFlowStore.draftScopeId(for: route, from: store),
      "home-flow:browse"
    )
  }

  // MARK: - Sync state tests

  /// The cursor is only valid for the entitlements it was issued under, so both are
  /// stored together.
  func testSyncStateKeepsCursorAndDeclaredOwnershipAfterMarkSynced() {
    EVYSyncState.reset()
    defer { EVYSyncState.reset() }

    XCTAssertNil(EVYSyncState.cursor)
    XCTAssertNil(EVYSyncState.declaredOwnership)

    EVYSyncState.markSynced(
      cursor: "2026-05-05T00:00:00.000Z", declaredOwnership: "svc/res:id")

    XCTAssertEqual(EVYSyncState.cursor, "2026-05-05T00:00:00.000Z")
    XCTAssertEqual(EVYSyncState.declaredOwnership, "svc/res:id")
  }

  // MARK: - Row payload decoding tests (in-memory UI_Row path)

  func testListItemRowDecodesCorrectly() throws {
    let json: [String: Any] = [
      "id": "list-item-row-id",
      "type": "list_item",
      "actions": [:],
      "title": "Test title",
      "subtitle": "Test subtitle",
      "image": "",
    ]

    let data = try JSONSerialization.data(withJSONObject: json)
    let row = try JSONDecoder().decode(UI_Row.self, from: data)
    guard case .listItem(let viewData, _) = try UI_RowPayload.from(row: row) else {
      return XCTFail("Expected .listItem payload")
    }
    XCTAssertEqual(viewData.title, "Test title")
    XCTAssertEqual(viewData.subtitle, "Test subtitle")
  }

  func testDatumRowFormatterCollectsSearchableContentFromRootAndNestedRows() throws {
    let flatRow = try decodeRow([
      "id": "search-result-template",
      "type": "list_item",
      "actions": [:],
      "title": "Item title",
      "subtitle": "Sydney",
    ])
    let flatSearchableValues = try EVYDatumRowFormatter(template: flatRow)
      .formattedResult(datum: .dictionary([:]))
      .searchableValues
    XCTAssertTrue(flatSearchableValues.contains("Sydney"))
    XCTAssertTrue(flatSearchableValues.contains("Item title"))

    let nestedRow = try decodeRow([
      "id": "search-result-template",
      "type": "search",
      "actions": [:],
      "title": "Item title",
      "source": "{items}",
      "destination": "{query}",
      "child": [
        "id": "search-result-child",
        "type": "button",
        "actions": [:],
        "title": "",
        "label": "Inner label",
      ],
    ])
    let nestedSearchableValues = try EVYDatumRowFormatter(template: nestedRow)
      .formattedResult(datum: .dictionary([:]))
      .searchableValues
    XCTAssertTrue(nestedSearchableValues.contains("Inner label"))
    XCTAssertTrue(nestedSearchableValues.contains("Item title"))
  }

  func testHomepageSearchResultTemplateFormatsMarketplaceItem() throws {
    let row = try decodeRow([
      "id": "homepage-search-result-template",
      "type": "list_item",
      "actions": [:],
      "title": "{$datum.title}",
      "subtitle": "{formatCurrency($datum.price)}",
      "image": "{$datum.photo_ids.0}",
    ])
    let formatter = try EVYDatumRowFormatter(template: row)
    let datum = EVYJson.dictionary([
      "id": .string("item-1"),
      "title": .string("Visible item"),
      "price": .dictionary(["value": .string("10")]),
      "photo_ids": .array([.string("photo-1")]),
    ])

    let formattedRow = try formatter.formattedResult(datum: datum).row

    guard case .listItem(let viewData, _) = try UI_RowPayload.from(row: formattedRow) else {
      return XCTFail("Expected .listItem payload")
    }
    XCTAssertEqual(viewData.title, "Visible item")
    XCTAssertEqual(viewData.subtitle, "$10.00")
    XCTAssertEqual(viewData.image, "photo-1")
  }

  func testPlaceSearchResultTemplateFormatsFlatAddressFields() throws {
    let row = try decodeRow([
      "id": "place-search-result-template",
      "type": "text",
      "actions": [:],
      "title": "{$datum.unit} {$datum.street}",
      "subtitle": "{$datum.postcode} {$datum.city}, {$datum.state}",
    ])
    let formatter = try EVYDatumRowFormatter(template: row)
    let datum = EVYJson.dictionary([
      "id": .string("ChIJRothschild"),
      "unit": .string("C509"),
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "state": .string("NSW"),
      "postcode": .string("2018"),
      "country": .string("Australia"),
    ])

    let formattedRow = try formatter.formattedResult(datum: datum).row

    XCTAssertEqual(formattedRow.title, "C509 28 Rothschild Avenue")
    XCTAssertEqual(formattedRow.subtitle, "2018 Rosebery, NSW")
  }

  func testPlaceSearchResultTemplateFormatsAddressLinesWithBareDatum() throws {
    let row = try decodeRow([
      "id": "place-search-result-address-lines",
      "type": "text",
      "actions": [:],
      "title": "{formatAddressLine1($datum)}",
      "subtitle": "{formatAddressLine2($datum)}",
    ])
    let formatter = try EVYDatumRowFormatter(template: row)
    let datum = EVYJson.dictionary([
      "id": .string("ChIJRothschild"),
      "unit": .string("C509"),
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "state": .string("NSW"),
      "postcode": .string("2018"),
      "country": .string("Australia"),
    ])

    let formattedRow = try formatter.formattedResult(datum: datum).row

    XCTAssertEqual(formattedRow.title, "C509 28 Rothschild Avenue")
    XCTAssertEqual(formattedRow.subtitle, "Rosebery, NSW 2018")
  }

  private func decodeRow(_ json: [String: Any]) throws -> UI_Row {
    let data = try JSONSerialization.data(withJSONObject: json)
    return try JSONDecoder().decode(UI_Row.self, from: data)
  }

  // MARK: - Stored record stability

  func testFlowFirstPageIdUnchangedWhenOnlyRowUpdates() throws {
    let store = makeStore()
    let flowId = "home-flow"
    let pageId = "home-page"
    let rowId = "home-button"

    try seedFlow(store: store, id: flowId, pageIds: [pageId])
    try seedPage(store: store, id: pageId, rowIds: [rowId])
    try seedRow(
      store: store, id: rowId, type: "button",
      data: ["source": "", "title": "", "label": "Before", "actions": [:]])

    let firstPageIdBefore = EVYFlowStore.firstPageId(inFlowId: flowId, from: store)

    try seedRow(
      store: store, id: rowId, type: "button",
      data: ["source": "", "title": "", "label": "After", "actions": [:]])

    let firstPageIdAfter = EVYFlowStore.firstPageId(inFlowId: flowId, from: store)
    XCTAssertEqual(firstPageIdBefore, firstPageIdAfter)
    XCTAssertEqual(firstPageIdAfter, pageId)
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
}
