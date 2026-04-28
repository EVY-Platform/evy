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
    XCTAssertEqual(EVYFlowDraftScopeResolver.draftScopeId(for: route, flows: flows), "home-flow:browse")
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
                    "true": "navigate:create-flow:create-page",
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
                "source": "{item}",
                "view": [
                  "content": [
                    "title": "Title",
                    "value": "",
                    "placeholder": "Enter a title",
                  ]
                ],
                "destination": "{title}",
                "actions": [],
              ]
            ],
            "footer": [
              "id": "submit-button",
              "type": "Button",
              "source": "{item}",
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
                  "true": "{create(item)}",
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