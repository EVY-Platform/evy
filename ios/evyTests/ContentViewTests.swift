//
//  ContentViewTests.swift
//  evyTests
//

import XCTest

@testable import evy

enum MarketplaceTestFixture {
  static let itemsResourceId = MarketplaceResource.items.rawValue
  static let serviceId = MARKETPLACE_SERVICE
}

@MainActor
final class ContentViewTests: XCTestCase {

  // MARK: - Store seeding helpers

  private func makeStore() -> EVYDataStore {
    EVYDataStore(name: UUID().uuidString, inMemoryOnly: true)
  }

  private func seedFlow(store: EVYDataStore, id: String, pageIds: [String]) throws {
    let json: [String: Any] = [
      "id": id,
      "name": "Test Flow",
      "pageIds": pageIds,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
    ]
    let data = try JSONSerialization.data(withJSONObject: json)
    try store.upsert(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.flows.rawValue,
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
      "rowIds": rowIds,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
    ]
    if let footerRowId {
      json["footerRowId"] = footerRowId
    }
    let data = try JSONSerialization.data(withJSONObject: json)
    try store.upsert(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.pages.rawValue,
      id: id,
      value: data
    )
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
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
    ]
    let jsonData = try JSONSerialization.data(withJSONObject: json)
    try store.upsert(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.rawValue,
      id: id,
      value: jsonData
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
      store: store, id: rowId, type: "Text",
      data: ["source": "", "title": "Hello", "text": "World", "actions": []])

    let firstPageId = EVYFlowStore.firstPageId(inFlowId: flowId, from: store)
    XCTAssertEqual(firstPageId, pageId)

    let storedPage = EVYPageStore.page(id: pageId, from: store)
    XCTAssertEqual(storedPage?.rowIds.count, 1)
    XCTAssertEqual(storedPage?.rowIds.first, rowId)
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

  func testRowStoreExposesChildRowId() throws {
    let store = makeStore()
    let parentId = "parent-row"
    let childId = "child-row"

    try seedRow(
      store: store, id: parentId, type: "Button",
      data: [
        "source": "", "title": "", "label": "Parent", "actions": [],
        "child_row_id": childId,
      ])
    try seedRow(
      store: store, id: childId, type: "Text",
      data: ["source": "", "title": "Child title", "text": "Body", "actions": []])

    let storedParent = try XCTUnwrap(EVYRowStore.row(id: parentId, from: store))
    XCTAssertEqual(storedParent.childRowId, childId)

    let storedChild = try XCTUnwrap(EVYRowStore.row(id: childId, from: store))
    XCTAssertEqual(storedChild.id, childId)
    XCTAssertNil(storedChild.childRowId)
  }

  func testRowStoreExposesChildrenRowIds() throws {
    let store = makeStore()
    let containerId = "container-row"
    let childOneId = "child-one"
    let childTwoId = "child-two"

    try seedRow(
      store: store, id: containerId, type: "ColumnContainer",
      data: [
        "source": "", "title": "", "actions": [],
        "children_row_ids": [childOneId, childTwoId],
      ])

    let storedContainer = try XCTUnwrap(EVYRowStore.row(id: containerId, from: store))
    XCTAssertEqual(storedContainer.childrenRowIds, [childOneId, childTwoId])
  }

  func testWalkerVisitsRowsInOrder() throws {
    let store = makeStore()
    let pageId = "walk-page"
    let rowOneId = "walk-row-one"
    let rowTwoId = "walk-row-two"

    try seedPage(store: store, id: pageId, rowIds: [rowOneId, rowTwoId])
    try seedRow(
      store: store, id: rowOneId, type: "Text",
      data: ["source": "", "title": "One", "actions": []])
    try seedRow(
      store: store, id: rowTwoId, type: "Text",
      data: ["source": "", "title": "Two", "actions": []])

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
      store: store, id: parentId, type: "Button",
      data: [
        "source": "", "title": "", "label": "Parent", "actions": [],
        "child_row_id": childId,
      ])
    try seedRow(
      store: store, id: childId, type: "Text",
      data: ["source": "", "title": "Child title", "actions": []])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [parentId, childId])
  }

  func testWalkerDescendsIntoChildrenRowIds() throws {
    let store = makeStore()
    let pageId = "children-walk-page"
    let containerId = "children-walk-container"
    let childOneId = "children-walk-child-one"
    let childTwoId = "children-walk-child-two"

    try seedPage(store: store, id: pageId, rowIds: [containerId])
    try seedRow(
      store: store, id: containerId, type: "ColumnContainer",
      data: [
        "source": "", "title": "", "actions": [],
        "children_row_ids": [childOneId, childTwoId],
      ])
    try seedRow(
      store: store, id: childOneId, type: "Text",
      data: ["source": "", "title": "One", "actions": []])
    try seedRow(
      store: store, id: childTwoId, type: "Text",
      data: ["source": "", "title": "Two", "actions": []])

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
      store: store, id: rowOneId, type: "Button",
      data: [
        "source": "", "title": "", "label": "", "actions": [],
        "child_row_id": rowTwoId,
      ])
    try seedRow(
      store: store, id: rowTwoId, type: "Button",
      data: [
        "source": "", "title": "", "label": "", "actions": [],
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
      store: store, id: rowId, type: "Text",
      data: ["source": "", "title": "Body", "actions": []])
    try seedRow(
      store: store, id: footerId, type: "Button",
      data: ["source": "", "title": "", "label": "Footer", "actions": []])

    var visitedIds: [String] = []
    forEachStoredRow(inPageId: pageId, from: store) { row in visitedIds.append(row.id) }
    XCTAssertEqual(visitedIds, [rowId, footerId])
  }

  func testUiRowBuildsContentWithoutChildren() throws {
    let store = makeStore()
    let parentId = "content-parent"
    let childId = "content-child"

    try seedRow(
      store: store, id: parentId, type: "Button",
      data: [
        "source": "", "title": "", "label": "Parent button",
        "actions": [], "child_row_id": childId,
      ])

    let storedRow = try XCTUnwrap(EVYRowStore.row(id: parentId, from: store))
    let uiRow = try XCTUnwrap(storedRow.uiRow())

    XCTAssertEqual(uiRow.id, parentId)
    XCTAssertEqual(uiRow.type, .button)
    XCTAssertNil(uiRow.child)
    XCTAssertTrue(uiRow.children.isEmpty)
    XCTAssertEqual(storedRow.childRowId, childId)
  }

  func testRowRefIdTemplateRowResolvesFromStore() throws {
    let store = makeStore()
    let templateId = "template-row"

    try seedRow(
      store: store, id: templateId, type: "Text",
      data: ["source": "", "title": "{$datum.title}", "actions": []])

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

  // MARK: - EVYFlowDraftScopeResolver tests

  func testExtractCreateKeysReturnsEmptyForUnknownFlowId() {
    let store = makeStore()
    let keys = EVYFlowStore.createKeys(flowId: "unknown-flow", from: store)
    XCTAssertEqual(keys, [])
  }

  func testExtractCreateKeysFindsCreateActions() throws {
    let store = makeStore()

    try seedFlow(store: store, id: "create-flow", pageIds: ["create-page"])
    try seedPage(
      store: store, id: "create-page", rowIds: ["title-row"],
      footerRowId: "submit-button")
    try seedRow(
      store: store, id: "title-row", type: "Input",
      data: [
        "source": "",
        "title": "Title",
        "value": "",
        "placeholder": "Enter a title",
        "destination": "{\(MarketplaceTestFixture.itemsResourceId).title}",
        "actions": [],
      ])
    try seedRow(
      store: store, id: "submit-button", type: "Button",
      data: [
        "source": "", "title": "", "label": "Submit",
        "actions": [
          [
            "condition": "",
            "false": "",
            "true":
              "{create(\(MarketplaceTestFixture.serviceId),\(MarketplaceTestFixture.itemsResourceId))}",
          ]
        ],
      ])

    let keys = EVYFlowStore.createKeys(flowId: "create-flow", from: store)
    XCTAssertEqual(keys, Set([MarketplaceTestFixture.itemsResourceId]))
  }

  func testExtractCreateKeysReturnsEmptyForFlowWithoutCreateActions() throws {
    let store = makeStore()

    try seedFlow(store: store, id: "home-flow", pageIds: ["home-page"])
    try seedPage(store: store, id: "home-page", rowIds: ["home-button"])
    try seedRow(
      store: store, id: "home-button", type: "Button",
      data: [
        "source": "", "title": "", "label": "Go",
        "actions": [
          [
            "condition": "",
            "false": "",
            "true": "{navigate(another-flow,another-page)}",
          ]
        ],
      ])

    let keys = EVYFlowStore.createKeys(flowId: "home-flow", from: store)
    XCTAssertEqual(keys, [])
  }

  func testDraftScopeIdForCreateFlowMatchesFlowAndEntityKey() throws {
    let store = makeStore()

    try seedFlow(store: store, id: "create-flow", pageIds: ["create-page"])
    try seedPage(
      store: store, id: "create-page", rowIds: [],
      footerRowId: "submit-button")
    try seedRow(
      store: store, id: "submit-button", type: "Button",
      data: [
        "source": "", "title": "", "label": "Submit",
        "actions": [
          [
            "condition": "",
            "false": "",
            "true":
              "{create(\(MarketplaceTestFixture.serviceId),\(MarketplaceTestFixture.itemsResourceId))}",
          ]
        ],
      ])

    let route = Route(flowId: "create-flow", pageId: "create-page")
    XCTAssertEqual(
      EVYFlowDraftScopeResolver.draftScopeId(for: route, from: store),
      EVYDraft.createMergeScopeId(
        flowId: "create-flow", entityKey: MarketplaceTestFixture.itemsResourceId)
    )
  }

  func testDraftScopeIdForHomeFlowWithoutCreateUsesBrowseSuffix() throws {
    let store = makeStore()

    try seedFlow(store: store, id: "home-flow", pageIds: ["home-page"])
    try seedPage(store: store, id: "home-page", rowIds: [])

    let route = Route(flowId: "home-flow", pageId: "home-page")
    XCTAssertEqual(
      EVYFlowDraftScopeResolver.draftScopeId(for: route, from: store),
      "home-flow:browse"
    )
  }

  // MARK: - Sync state tests (unrelated to flow shape)

  func testSyncStateResetsStoredTimestampWhenStorageVersionChanges() {
    EVYSyncState.reset()
    defer { EVYSyncState.reset() }

    UserDefaults.standard.set("2026-01-01T00:00:00.000Z", forKey: "lastSyncTimestamp")

    XCTAssertEqual(EVYSyncState.lastSyncTimestamp, "1970-01-01T00:00:00.000Z")
  }

  func testSyncStateKeepsTimestampAfterCurrentVersionIsMarkedSynced() {
    EVYSyncState.reset()
    defer { EVYSyncState.reset() }

    EVYSyncState.markSynced()

    XCTAssertNotEqual(EVYSyncState.lastSyncTimestamp, "1970-01-01T00:00:00.000Z")
  }

  // MARK: - Row payload decoding tests (in-memory UI_Row path)

  func testListItemRowDecodesCorrectly() throws {
    let json: [String: Any] = [
      "id": "list-item-row-id",
      "type": "ListItem",
      "actions": [],
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
      "type": "ListItem",
      "actions": [],
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
      "type": "TextAction",
      "actions": [],
      "title": "Item title",
      "subtitle": "Sydney",
      "child": [
        "id": "search-result-child",
        "type": "Button",
        "actions": [],
        "title": "",
        "label": "Inner label",
      ],
    ])
    let nestedSearchableValues = try EVYDatumRowFormatter(template: nestedRow)
      .formattedResult(datum: .dictionary([:]))
      .searchableValues
    XCTAssertTrue(nestedSearchableValues.contains("Inner label"))
    XCTAssertTrue(nestedSearchableValues.contains("Sydney"))
  }

  func testHomepageSearchResultTemplateFormatsMarketplaceItem() throws {
    let row = try decodeRow([
      "id": "homepage-search-result-template",
      "type": "ListItem",
      "actions": [],
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

  private func decodeRow(_ json: [String: Any]) throws -> UI_Row {
    let data = try JSONSerialization.data(withJSONObject: json)
    return try JSONDecoder().decode(UI_Row.self, from: data)
  }

  // MARK: - Stored record equality

  func testStoredRowEqualityIgnoresIdenticalData() throws {
    let store = makeStore()
    let rowId = "equality-row"

    try seedRow(
      store: store, id: rowId, type: "Button",
      data: ["source": "", "title": "", "label": "Same", "actions": []])

    let firstRead = try XCTUnwrap(EVYRowStore.row(id: rowId, from: store))
    let secondRead = try XCTUnwrap(EVYRowStore.row(id: rowId, from: store))
    XCTAssertEqual(firstRead, secondRead)
  }

  func testStoredRowEqualityDetectsLabelChange() throws {
    let store = makeStore()
    let rowId = "changed-row"

    try seedRow(
      store: store, id: rowId, type: "Button",
      data: ["source": "", "title": "", "label": "Before", "actions": []])
    let before = try XCTUnwrap(EVYRowStore.row(id: rowId, from: store))

    try seedRow(
      store: store, id: rowId, type: "Button",
      data: ["source": "", "title": "", "label": "After", "actions": []])
    let after = try XCTUnwrap(EVYRowStore.row(id: rowId, from: store))

    XCTAssertNotEqual(before, after)
  }

  func testStoredPageEqualityDetectsRowOrderChange() throws {
    let store = makeStore()
    let pageId = "page-order"

    try seedPage(store: store, id: pageId, rowIds: ["row-a", "row-b"])
    let before = try XCTUnwrap(EVYPageStore.page(id: pageId, from: store))

    try seedPage(store: store, id: pageId, rowIds: ["row-b", "row-a"])
    let after = try XCTUnwrap(EVYPageStore.page(id: pageId, from: store))

    XCTAssertNotEqual(before, after)
  }

  func testFlowFirstPageIdUnchangedWhenOnlyRowUpdates() throws {
    let store = makeStore()
    let flowId = "home-flow"
    let pageId = "home-page"
    let rowId = "home-button"

    try seedFlow(store: store, id: flowId, pageIds: [pageId])
    try seedPage(store: store, id: pageId, rowIds: [rowId])
    try seedRow(
      store: store, id: rowId, type: "Button",
      data: ["source": "", "title": "", "label": "Before", "actions": []])

    let firstPageIdBefore = EVYFlowStore.firstPageId(inFlowId: flowId, from: store)

    try seedRow(
      store: store, id: rowId, type: "Button",
      data: ["source": "", "title": "", "label": "After", "actions": []])

    let firstPageIdAfter = EVYFlowStore.firstPageId(inFlowId: flowId, from: store)
    XCTAssertEqual(firstPageIdBefore, firstPageIdAfter)
    XCTAssertEqual(firstPageIdAfter, pageId)
  }
}
