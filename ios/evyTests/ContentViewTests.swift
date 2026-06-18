//
//  ContentViewTests.swift
//  evyTests
//

import XCTest

@testable import evy

enum MarketplaceTestFixture {
  static let itemsResourceId = "dc28ed59-298e-493c-8ff3-3e60f2ebccbd"
  static let serviceId = "66b092ae-7cd8-4d67-95b7-30b03568fd90"
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
                "view": [
                  "content": [
                    "title": "",
                    "label": "Parent button",
                    "child": [
                      "id": "text-child",
                      "type": "Text",
                      "source": "",
                      "destination": "",
                      "view": [
                        "content": [
                          "title": "Child title",
                          "text": "Child body",
                        ],
                        "max_lines": "",
                      ],
                      "actions": [],
                    ],
                  ]
                ],
                "actions": [],
              ]
            ],
          ]
        ],
      ]
    ]

    let data = try JSONSerialization.data(withJSONObject: json)
    let flows = try JSONDecoder().decode([UI_Flow].self, from: data)
    let rootRow = try XCTUnwrap(flows.first?.pages.first?.rows.first)

    XCTAssertEqual(rootRow.view.content.child?.id, "text-child")

    var visitedIds: [String] = []
    if let page = flows.first?.pages.first {
      forEachRow(in: page) { row in visitedIds.append(row.id) }
    }
    XCTAssertEqual(visitedIds, ["button-parent", "text-child"])

    guard case .button(let viewData, _, _, _) = try UI_RowPayload.from(row: rootRow) else {
      return XCTFail("Expected Button payload")
    }
    XCTAssertEqual(viewData.content.child?.id, "text-child")
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
      "view": [
        "content": [
          "title": "Test title",
          "subtitle": "Test subtitle",
          "image": "",
        ]
      ],
    ]

    let data = try JSONSerialization.data(withJSONObject: json)
    let row = try JSONDecoder().decode(UI_Row.self, from: data)
    guard case .listItem(let viewData, _, _, _) = try UI_RowPayload.from(row: row) else {
      return XCTFail("Expected .listItem payload")
    }
    XCTAssertEqual(viewData.content.title, "Test title")
    XCTAssertEqual(viewData.content.subtitle, "Test subtitle")
  }

  func testDatumRowFormatterSearchesAllContentStrings() throws {
    let row = try decodeRow([
      "id": "search-result-template",
      "type": "ListItem",
      "source": "",
      "destination": "",
      "actions": [],
      "view": [
        "content": [
          "title": "Item title",
          "subtitle": "Sydney",
          "segments": ["first", "second"],
          "child": [
            "id": "search-result-child",
            "type": "Button",
            "source": "",
            "destination": "",
            "actions": [],
            "view": [
              "content": [
                "title": "",
                "label": "Inner label",
              ]
            ],
          ],
        ]
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
      "view": [
        "content": [
          "title": "{$datum.title}",
          "subtitle": "{formatCurrency($datum.price)}",
          "image": "{$datum.photo_ids.0}",
        ]
      ],
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
    XCTAssertEqual(viewData.content.title, "Visible item")
    XCTAssertEqual(viewData.content.subtitle, "$10.00")
    XCTAssertEqual(viewData.content.image, "photo-1")
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
                "view": [
                  "content": [
                    "title": "",
                    "label": "Create",
                  ]
                ],
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
                "view": [
                  "content": [
                    "title": "Title",
                    "value": "",
                    "placeholder": "Enter a title",
                  ]
                ],
                "destination": "{\(MarketplaceTestFixture.itemsResourceId).title}",
                "actions": [],
              ]
            ],
            "footer": [
              "id": "submit-button",
              "type": "Button",
              "source": "",
              "view": [
                "content": [
                  "title": "",
                  "label": "Submit",
                ]
              ],
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
