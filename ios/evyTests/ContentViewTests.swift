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

  func testExtractCreateKeysReturnsEmptyForNilFlow() {
    let keys = EVYFlowDraftScopeResolver.extractCreateKeys(from: nil)
    XCTAssertEqual(keys, [])
  }

  func testExtractCreateKeysFindsCreateActions() throws {
    let flows = try makeFlows()
    let createFlow = flows.first(where: { $0.id == "create-flow" })
    let keys = EVYFlowDraftScopeResolver.extractCreateKeys(from: createFlow)
    XCTAssertEqual(keys, Set([MarketplaceTestFixture.itemsResourceId]))
  }

  func testExtractCreateKeysReturnsEmptyForFlowWithoutCreateActions() throws {
    let flows = try makeFlows()
    let homeFlow = flows.first(where: { $0.id == "home-flow" })
    let keys = EVYFlowDraftScopeResolver.extractCreateKeys(from: homeFlow)
    XCTAssertEqual(keys, [])
  }

  func testDraftScopeIdForCreateFlowMatchesFlowAndEntityKey() throws {
    let flows = try makeFlows()
    let route = Route(flowId: "create-flow", pageId: "create-page")
    XCTAssertEqual(
      EVYFlowDraftScopeResolver.draftScopeId(for: route, flows: flows),
      EVYDraft.createMergeScopeId(
        flowId: "create-flow", entityKey: MarketplaceTestFixture.itemsResourceId)
    )
  }

  func testDraftScopeIdForHomeFlowWithoutCreateUsesBrowseSuffix() throws {
    let flows = try makeFlows()
    let route = Route(flowId: "home-flow", pageId: "home-page")
    XCTAssertEqual(
      EVYFlowDraftScopeResolver.draftScopeId(for: route, flows: flows), "home-flow:browse")
  }

  func testAnyRowTypeCanDecodeAChildRow() throws {
    let json: [[String: Any]] = [
      [
        "id": "child-flow",
        "name": "Child Flow",
        "pages": [
          [
            "id": "child-page",
            "title": "Child Page",
            "rows": [
              [
                "id": "button-parent",
                "type": "Button",
                "source": "",
                "destination": "",
                "title": "",
                "label": "Parent button",
                "child": [
                  "id": "text-child",
                  "type": "Text",
                  "source": "",
                  "destination": "",
                  "title": "Child title",
                  "text": "Child body",
                  "actions": [],
                  "visible": "true",
                ],
                "actions": [],
                "visible": "true",
              ]
            ],
          ]
        ],
      ]
    ]

    let data = try JSONSerialization.data(withJSONObject: json)
    let flows = try JSONDecoder().decode([UI_Flow].self, from: data)
    let rootRow = try XCTUnwrap(flows.first?.pages.first?.rows.first)

    XCTAssertEqual(rootRow.child?.id, "text-child")

    var visitedIds: [String] = []
    if let page = flows.first?.pages.first {
      forEachRow(in: page) { row in visitedIds.append(row.id) }
    }
    XCTAssertEqual(visitedIds, ["button-parent", "text-child"])

    guard case .button(let viewData, _, _, _) = try UI_RowPayload.from(row: rootRow) else {
      return XCTFail("Expected Button payload")
    }
    XCTAssertEqual(viewData.child?.id, "text-child")
  }

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

  func testListItemRowDecodesCorrectly() throws {
    let json: [String: Any] = [
      "id": "list-item-row-id",
      "type": "ListItem",
      "source": "",
      "destination": "",
      "actions": [],
      "title": "Test title",
      "subtitle": "Test subtitle",
      "image": "",
    ]

    let data = try JSONSerialization.data(withJSONObject: json)
    let row = try JSONDecoder().decode(UI_Row.self, from: data)
    guard case .listItem(let viewData, _, _, _) = try UI_RowPayload.from(row: row) else {
      return XCTFail("Expected .listItem payload")
    }
    XCTAssertEqual(viewData.title, "Test title")
    XCTAssertEqual(viewData.subtitle, "Test subtitle")
  }

  func testDatumRowFormatterSearchesFlatContentStrings() throws {
    let row = try decodeRow([
      "id": "search-result-template",
      "type": "ListItem",
      "source": "",
      "destination": "",
      "actions": [],
      "title": "Item title",
      "subtitle": "Sydney",
      "segments": ["first", "second"],
      "child": [
        "id": "search-result-child",
        "type": "Button",
        "source": "",
        "destination": "",
        "actions": [],
        "title": "",
        "label": "Inner label",
      ],
    ])
    let formatter = try EVYDatumRowFormatter(template: row)

    let searchableValues = try formatter.formattedResult(datum: .dictionary([:])).searchableValues

    XCTAssertTrue(searchableValues.contains("Sydney"))
    XCTAssertTrue(searchableValues.contains("Inner label"))
    XCTAssertTrue(searchableValues.contains("first"))
  }

  func testHomepageSearchResultTemplateFormatsMarketplaceItem() throws {
    let row = try decodeRow([
      "id": "homepage-search-result-template",
      "type": "ListItem",
      "source": "",
      "destination": "",
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

    guard case .listItem(let viewData, _, _, _) = try UI_RowPayload.from(row: formattedRow) else {
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

  private func makeFlows() throws -> [UI_Flow] {
    let json: [[String: Any]] = [
      [
        "id": "home-flow",
        "name": "Home",
        "pages": [
          [
            "id": "home-page",
            "title": "Home",
            "rows": [
              [
                "id": "home-button",
                "type": "Button",
                "source": "",
                "title": "",
                "label": "Create",
                "actions": [
                  [
                    "condition": "",
                    "false": "",
                    "true": "{navigate(create-flow,create-page)}",
                  ]
                ],
              ]
            ],
          ]
        ],
      ],
      [
        "id": "create-flow",
        "name": "Create item",
        "pages": [
          [
            "id": "create-page",
            "title": "Create",
            "rows": [
              [
                "id": "title-row",
                "type": "Input",
                "source": "",
                "title": "Title",
                "value": "",
                "placeholder": "Enter a title",
                "destination": "{\(MarketplaceTestFixture.itemsResourceId).title}",
                "actions": [],
              ]
            ],
            "footer": [
              "id": "submit-button",
              "type": "Button",
              "source": "",
              "title": "",
              "label": "Submit",
              "actions": [
                [
                  "condition": "",
                  "false": "",
                  "true":
                    "{create(\(MarketplaceTestFixture.serviceId),\(MarketplaceTestFixture.itemsResourceId))}",
                ]
              ],
            ],
          ]
        ],
      ],
    ]

    let data = try JSONSerialization.data(withJSONObject: json)
    return try JSONDecoder().decode([UI_Flow].self, from: data)
  }
}
