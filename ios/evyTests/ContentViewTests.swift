//
//  ContentViewTests.swift
//  evyTests
//

import XCTest

@testable import evy

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
    XCTAssertEqual(keys, Set(["item"]))
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
      EVYDraft.createMergeScopeId(flowId: "create-flow", entityKey: "item")
    )
  }

  func testDraftScopeIdForHomeFlowWithoutCreateUsesBrowseSuffix() throws {
    let flows = try makeFlows()
    let route = Route(flowId: "home-flow", pageId: "home-page")
    XCTAssertEqual(
      EVYFlowDraftScopeResolver.draftScopeId(for: route, flows: flows), "home-flow:browse")
  }

  func testResourceNamePluralizes() {
    XCTAssertEqual(EVY.resourceName(forEntityKey: "item"), "items")
    XCTAssertEqual(EVY.resourceName(forEntityKey: "condition"), "conditions")
    XCTAssertEqual(EVY.resourceName(forEntityKey: "duration"), "durations")
    XCTAssertEqual(EVY.resourceName(forEntityKey: "area"), "areas")
    XCTAssertEqual(EVY.resourceName(forEntityKey: "provider"), "providers")
    XCTAssertEqual(
      EVY.resourceName(forEntityKey: "organisation"), EVYCoreResource.organisations.rawValue)
    XCTAssertEqual(EVY.resourceName(forEntityKey: "tag"), "tags")
  }

  func testResourceNameInflectsOnlyLastSegment() {
    XCTAssertEqual(EVY.resourceName(forEntityKey: "selling_reason"), "selling_reasons")
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
                "destination": "{item.title}",
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
                  "true": "{create(marketplace,item)}",
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
