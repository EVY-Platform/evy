//
//  ContentViewTests.swift
//  evyTests
//
//  Created by Cursor on 20/3/2026.
//

import XCTest
@testable import evy

@MainActor
final class ContentViewTests: XCTestCase {
    func testCreateKeysToDeleteDoesNotCleanWhenEnteringCreateFlow() throws {
        let flows = try makeFlows()

        let keysToDelete = ContentView.createKeysToDelete(
            whenLeaving: "home-flow",
            flows: flows,
            activeDraftKeys: ["item"]
        )

        XCTAssertEqual(keysToDelete, [])
    }

    func testCreateKeysToDeleteCleansCreateFlowKeysWhenLeavingCreateFlow() throws {
        let flows = try makeFlows()

        let keysToDelete = ContentView.createKeysToDelete(
            whenLeaving: "create-flow",
            flows: flows,
            activeDraftKeys: ["item"]
        )

        XCTAssertEqual(keysToDelete, ["item"])
    }

    private func makeFlows() throws -> [SDUI_Flow] {
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
                                "view": [
                                    "content": [
                                        "title": "",
                                        "label": "Create"
                                    ]
                                ],
                                "actions": [
                                    [
                                        "condition": "",
                                        "false": "",
                                        "true": "navigate:create-flow:create-page"
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
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
                                "view": [
                                    "content": [
                                        "title": "Title",
                                        "value": "",
                                        "placeholder": "Enter a title"
                                    ]
                                ],
                                "destination": "{title}",
                                "actions": []
                            ]
                        ],
                        "footer": [
                            "id": "submit-button",
                            "type": "Button",
                            "view": [
                                "content": [
                                    "title": "",
                                    "label": "Submit"
                                ]
                            ],
                            "actions": [
                                [
                                    "condition": "",
                                    "false": "",
                                    "true": "{create(item)}"
                                ]
                            ]
                        ]
                    ]
                ]
            ]
        ]

        let data = try JSONSerialization.data(withJSONObject: json)
        return try JSONDecoder().decode([SDUI_Flow].self, from: data)
    }
}
