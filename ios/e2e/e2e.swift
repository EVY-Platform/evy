//
//  e2e.swift
//  evyUITests
//

import XCTest

// MARK: - Minimal WebSocket Emitter for E2E Tests

actor WSEmitter {
    private var ws: URLSessionWebSocketTask?
    private var msgId = 0

    func connect(host: String) async throws {
        let url = URL(string: "ws://\(host)")!
        ws = URLSession.shared.webSocketTask(with: url)
        ws?.resume()
        try await Task.sleep(nanoseconds: 300_000_000) // 0.3s for connection
    }

    func login(token: String, os: String) async throws {
        let response = try await send(method: "rpc.login", params: ["token": token, "os": os])
        guard response["result"] as? Bool == true else {
            throw NSError(domain: "WSEmitter", code: 1, userInfo: [NSLocalizedDescriptionKey: "Login failed"])
        }
    }

    func updateSDUI(flowData: [String: Any], flowId: String) async throws {
        let params: [String: Any] = [
            "service": "evy",
            "resource": "sdui",
            "filter": ["id": flowId],
            "data": flowData
        ]
        _ = try await send(method: "upsert", params: params)
    }

    func getResource(service: String, resource: String, filter: [String: Any]? = nil) async throws -> Any {
        var params: [String: Any] = ["service": service, "resource": resource]
        if let filter = filter {
            params["filter"] = filter
        }
        let response = try await send(method: "get", params: params)
        guard let result = response["result"] else {
            throw NSError(
                domain: "WSEmitter",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "get response missing result"]
            )
        }
        return result
    }

    func disconnect() { ws?.cancel(with: .normalClosure, reason: nil) }

    private func send(method: String, params: Any) async throws -> [String: Any] {
        msgId += 1
        let msg: [String: Any] = ["jsonrpc": "2.0", "id": msgId, "method": method, "params": params]
        let json = String(data: try JSONSerialization.data(withJSONObject: msg), encoding: .utf8)!
        try await ws?.send(.string(json))

        while true {
            let result = try await ws?.receive()
            guard case .string(let text) = result,
                  let data = text.data(using: .utf8),
                  let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                return [:]
            }
            if response["id"] == nil { continue }
            if let error = response["error"] as? [String: Any] {
                let message = (error["message"] as? String) ?? "JSON-RPC error"
                throw NSError(
                    domain: "WSEmitter",
                    code: (error["code"] as? Int) ?? -1,
                    userInfo: [NSLocalizedDescriptionKey: "\(method) failed: \(message)"]
                )
            }
            return response
        }
    }
}

// MARK: - Base class for E2E tests

class E2ETestBase: XCTestCase {

    var app: XCUIApplication!

    func clearAndType(field: XCUIElement, text: String, placeholder: String? = nil) {
        if let existingText = field.value as? String, !existingText.isEmpty {
            let shouldClearExistingText = placeholder == nil || existingText != placeholder
            if shouldClearExistingText {
                field.tap()
                field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existingText.count))
            }
        }
        field.typeText(text)
    }

    func findElement(identifier: String) -> XCUIElement? {
        let otherElement = app.otherElements[identifier].firstMatch
        if otherElement.waitForExistence(timeout: 2) {
            return otherElement
        }
        let descendant = app.descendants(matching: .any)[identifier].firstMatch
        if descendant.waitForExistence(timeout: 2) {
            return descendant
        }
        return nil
    }

    func findElement(identifiers: [String], containsAny tokens: [String]) -> XCUIElement? {
        for identifier in identifiers {
            if let element = findElement(identifier: identifier) {
                return element
            }
        }
        for token in tokens {
            let predicate = NSPredicate(format: "identifier CONTAINS %@", token)
            let matches = app.descendants(matching: .any).matching(predicate)
            let count = matches.count
            if count > 0 {
                for index in 0..<count {
                    let element = matches.element(boundBy: index)
                    if element.exists {
                        return element
                    }
                }
            }
            let firstMatch = matches.firstMatch
            if firstMatch.waitForExistence(timeout: 2) {
                return firstMatch
            }
        }
        return nil
    }

    func findElementWithScroll(identifiers: [String],
                              containsAny tokens: [String],
                              in scrollView: XCUIElement,
                              maxScrollAttempts: Int = 6) -> XCUIElement? {
        if let element = findElement(identifiers: identifiers, containsAny: tokens) {
            return element
        }
        for _ in 0..<maxScrollAttempts {
            scrollView.swipeUp()
            if let element = findElement(identifiers: identifiers, containsAny: tokens) {
                return element
            }
        }
        return nil
    }

    func tapAndGetEditableField(container: XCUIElement) async -> XCUIElement? {
        container.tap()
        try? await Task.sleep(for: .milliseconds(500))
        let textField = container.textFields.firstMatch
        if textField.exists {
            return textField
        }
        let anyTextField = app.textFields.firstMatch
        if anyTextField.waitForExistence(timeout: 2) {
            return anyTextField
        }
        return nil
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        guard let apiHost = ProcessInfo.processInfo.environment["API_HOST"], !apiHost.isEmpty else {
            XCTFail("API_HOST is required (set by run-e2e.sh when running iOS e2e)")
            return
        }
        app.launchEnvironment["API_HOST"] = apiHost
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }
}

// MARK: - Navigation and visibility only

final class E2EFlowTests: E2ETestBase {

    func testNavigationAndVisibility() throws {
        XCTAssertTrue(app.exists, "App should launch successfully")

        let loadingIndicator = app.progressIndicators["loadingIndicator"]
        let homePage = app.scrollViews["page_55e427ac-263c-441f-9673-f60627b1baea"]
        let initialUIAppeared = loadingIndicator.waitForExistence(timeout: 5) || homePage.waitForExistence(timeout: 5)
        XCTAssertTrue(initialUIAppeared || app.buttons.count > 0 || app.staticTexts.count > 0,
                      "App should display initial UI after launch")

        let viewItemButton = app.buttons["View"]
        let createItemButton = app.buttons["Create"]
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20),
                      "Home screen not loaded - verify API is running and database is seeded")
        XCTAssertTrue(createItemButton.exists, "Create button should be visible")

        viewItemButton.tap()
        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after tapping View")
        XCTAssertFalse(viewItemButton.exists, "Home buttons should not be visible after navigation")

        let goHomeButton = app.buttons["Go home"]
        XCTAssertTrue(goHomeButton.waitForExistence(timeout: 5), "Footer 'Go home' button should be visible")

        let backButton = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")

        createItemButton.tap()
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after navigation")
        XCTAssertFalse(createItemButton.exists, "Home buttons should not be visible after navigation")

        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen after create flow")
    }
}

// MARK: - WebSocket and form data editing

final class WebSocketE2ETests: E2ETestBase {

    @MainActor
    func testWebSocketNotificationUpdatesUI() async throws {
        let viewItemButton = app.buttons["View"]
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20),
                      "Home screen not loaded - verify API is running and database is seeded")

        let originalLabel = "View"
        let updatedLabel = "Updated View \(Int(Date().timeIntervalSince1970))"

        guard let apiHost = ProcessInfo.processInfo.environment["API_HOST"], !apiHost.isEmpty else {
            XCTFail("API_HOST is required (set by run-e2e.sh when running iOS e2e)")
            return
        }
        let emitter = WSEmitter()
        do {
            try await emitter.connect(host: apiHost)
            try await emitter.login(token: "e2e-test", os: "ios")
            try await emitter.updateSDUI(
                flowData: createHomeFlowData(buttonLabel: updatedLabel),
                flowId: "f267c629-2594-4770-8cec-d5324ebb4058"
            )
        } catch {
            XCTFail("Failed to emit update: \(error.localizedDescription)")
            return
        }

        let updatedButton = app.buttons[updatedLabel]
        XCTAssertTrue(updatedButton.waitForExistence(timeout: 10),
                      "Button should update to '\(updatedLabel)' after notification")
        XCTAssertFalse(viewItemButton.exists, "Original button should be replaced")

        try? await emitter.updateSDUI(
            flowData: createHomeFlowData(buttonLabel: originalLabel),
            flowId: "f267c629-2594-4770-8cec-d5324ebb4058"
        )
        await emitter.disconnect()
    }

    @MainActor
    func testConditionalActionEvaluatesLogicalExpression() async throws {
        let viewItemButton = app.buttons["View"]
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20),
                      "Home screen not loaded - verify API is running and database is seeded")

        guard let apiHost = ProcessInfo.processInfo.environment["API_HOST"], !apiHost.isEmpty else {
            XCTFail("API_HOST is required (set by run-e2e.sh when running iOS e2e)")
            return
        }

        let emitter = WSEmitter()
        let conditionalLabel = "Conditional \(Int(Date().timeIntervalSince1970))"

        do {
            try await emitter.connect(host: apiHost)
            try await emitter.login(token: "e2e-test", os: "ios")
            try await emitter.updateSDUI(
                flowData: createConditionalFlowData(buttonLabel: conditionalLabel),
                flowId: "f267c629-2594-4770-8cec-d5324ebb4058"
            )
        } catch {
            XCTFail("Failed to publish conditional flow: \(error.localizedDescription)")
            return
        }

        let conditionalButton = app.buttons[conditionalLabel]
        XCTAssertTrue(conditionalButton.waitForExistence(timeout: 10),
                      "Conditional button should exist after SDUI update")

        conditionalButton.tap()

        let goHomeButton = app.buttons["Go home"]
        XCTAssertTrue(goHomeButton.waitForExistence(timeout: 10),
                      "Tapping the conditional button should navigate when the logical expression is true")

        try? await emitter.updateSDUI(
            flowData: createHomeFlowData(buttonLabel: "View"),
            flowId: "f267c629-2594-4770-8cec-d5324ebb4058"
        )
        await emitter.disconnect()
    }

    @MainActor
    func testCreateItemFormEditing() async throws {
        let viewItemButton = app.buttons["View"]
        let createItemButton = app.buttons["Create"]
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20),
                      "Home screen not loaded - verify API is running and database is seeded")

        guard let apiHost = ProcessInfo.processInfo.environment["API_HOST"], !apiHost.isEmpty else {
            XCTFail("API_HOST is required (set by run-e2e.sh when running iOS e2e)")
            return
        }

        let emitter = WSEmitter()
        try await emitter.connect(host: apiHost)
        try await emitter.login(token: "e2e-test", os: "ios")
        try await emitter.updateSDUI(
            flowData: Self.minimalCreateItemFlowData(),
            flowId: "ca47e6c5-da19-4491-8422-adb40d9e8a27"
        )
        try await Task.sleep(for: .seconds(2))

        createItemButton.tap()

        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after navigation")

        // Title field
        guard let titleTextField = findElement(identifier: "textField_{title}") else {
            XCTFail("Title text field should exist with identifier 'textField_{title}'")
            return
        }
        guard let titleField = await tapAndGetEditableField(container: titleTextField) else {
            XCTFail("Failed to get editable title field")
            return
        }
        let testTitle = "Test Item Title \(Int(Date().timeIntervalSince1970))"
        clearAndType(field: titleField, text: testTitle, placeholder: "Item")
        let textFieldValue = titleField.value as? String ?? ""
        XCTAssertTrue(textFieldValue.contains("Test") || textFieldValue.contains("Item"),
                      "Text field should contain typed text, got: '\(textFieldValue)'")
        scrollView.tap()
        try await Task.sleep(for: .milliseconds(500))

        guard let priceTextField = findElementWithScroll(
            identifiers: [
                "textField_{price}",
                "textField_{item.price}",
                "textField_{buildCurrency(price)}",
            ],
            containsAny: ["price", "item.price", "buildCurrency"],
            in: scrollView
        ) else {
            XCTFail("Price field should exist (textField_{price}, textField_{item.price}, textField_{buildCurrency(price)}, or accessibility containing 'price')")
            return
        }
        guard let priceField = await tapAndGetEditableField(container: priceTextField) else {
            XCTFail("Failed to get editable price field")
            return
        }
        clearAndType(field: priceField, text: "99", placeholder: "0")
        let priceValue = priceField.value as? String ?? ""
        XCTAssertTrue(priceValue.contains("99"), "Price field should contain typed value, got: '\(priceValue)'")
        scrollView.tap()
        try await Task.sleep(for: .milliseconds(500))

        guard let widthTextField = findElementWithScroll(
            identifiers: ["textField_{width}", "textField_{item.dimensions.width}"],
            containsAny: ["width", "dimensions.width"],
            in: scrollView
        ) else {
            XCTFail("Width field should exist (textField_{width}, textField_{item.dimensions.width}, or accessibility containing 'width')")
            return
        }
        guard let widthField = await tapAndGetEditableField(container: widthTextField) else {
            XCTFail("Failed to get editable width field")
            return
        }
        clearAndType(field: widthField, text: "50", placeholder: "0")
        let widthValue = widthField.value as? String ?? ""
        XCTAssertTrue(widthValue.contains("50"), "Width field should contain typed value, got: '\(widthValue)'")
        scrollView.tap()
        try await Task.sleep(for: .milliseconds(500))

        let submitButton = app.buttons["Submit"]
        XCTAssertTrue(submitButton.waitForExistence(timeout: 5), "Submit should exist on minimal create flow")
        submitButton.tap()

        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 15),
                      "Should return to home after create(item)")

        let itemsPayload = try await emitter.getResource(service: "marketplace", resource: "items")
        XCTAssertTrue(
            Self.marketplaceItemsContainListing(title: testTitle, priceValue: 99, widthText: "50", items: itemsPayload),
            "Marketplace items should include listing with title, price.value 99, and width 50"
        )

        await emitter.disconnect()
    }

    private static func minimalCreateItemFlowData() -> [String: Any] {
        [
            "id": "ca47e6c5-da19-4491-8422-adb40d9e8a27",
            "name": "Create item",
            "pages": [
                [
                    "id": "306ed62c-c2af-4652-a873-26c7a388972d",
                    "title": "Create listing",
                    "rows": [
                        [
                            "id": "e0fc5df1-b4bf-4996-87f4-f2b0f3c2a0be",
                            "type": "Input",
                            "view": [
                                "content": [
                                    "title": "Title",
                                    "value": "{title}",
                                    "placeholder": "Item",
                                ],
                            ],
                            "destination": "{title}",
                            "actions": [],
                        ],
                        [
                            "id": "668aeb79-d8ba-43b7-9619-07f91d0a1908",
                            "type": "Input",
                            "view": [
                                "content": [
                                    "title": "Price",
                                    "value": "{formatCurrency(price)}",
                                    "placeholder": "0",
                                ],
                            ],
                            "destination": "{buildCurrency(price)}",
                            "actions": [],
                        ],
                        [
                            "id": "2a9b22a0-b0eb-4648-83ca-77b2b8748816",
                            "type": "Input",
                            "view": [
                                "content": [
                                    "title": "Width",
                                    "value": "{formatDimension(width)}",
                                    "placeholder": "0",
                                ],
                            ],
                            "destination": "{width}",
                            "actions": [],
                        ],
                    ],
                    "footer": [
                        "id": "1cb41189-6fa5-4562-996a-7cefb88a08ca",
                        "type": "Button",
                        "view": [
                            "content": [
                                "title": "",
                                "label": "Submit",
                            ],
                        ],
                        "actions": [
                            [
                                "condition": "",
                                "false": "",
                                "true": "{create(item)}",
                            ],
                        ],
                    ],
                ],
            ],
        ]
    }

    private static func marketplaceItemsContainListing(
        title: String,
        priceValue: Double,
        widthText: String,
        items: Any
    ) -> Bool {
        guard let arr = items as? [Any] else { return false }
        let normalizedExpectedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        for case let item as [String: Any] in arr {
            guard let t = item["title"] as? String else { continue }
            let normalizedActualTitle = t.trimmingCharacters(in: .whitespacesAndNewlines)
            guard normalizedActualTitle == normalizedExpectedTitle else { continue }
            var priceOk = false
            if let price = item["price"] as? [String: Any], let pv = price["value"] {
                if let d = pv as? Double, abs(d - priceValue) < 0.01 { priceOk = true }
                if let i = pv as? Int, Double(i) == priceValue { priceOk = true }
                if let n = pv as? NSNumber, abs(n.doubleValue - priceValue) < 0.01 { priceOk = true }
            }
            guard priceOk else { continue }
            let widthValue = item["width"] ?? (item["dimensions"] as? [String: Any])?["width"]
            if let w = widthValue as? String, w == widthText { return true }
            if let w = widthValue as? Int, String(w) == widthText { return true }
            if let n = widthValue as? NSNumber, n.stringValue == widthText { return true }
        }
        return false
    }

    private func createHomeFlowData(buttonLabel: String) -> [String: Any] {
        return [
            "id": "f267c629-2594-4770-8cec-d5324ebb4058",
            "name": "Home",
            "pages": [
                [
                    "id": "55e427ac-263c-441f-9673-f60627b1baea",
                    "title": "Home",
                    "rows": [
                        [
                            "id": "a74bc80e-ffda-4e19-b8f3-cd882405958b",
                            "type": "ColumnContainer",
                            "actions": [],
                            "view": [
                                "content": [
                                    "title": "",
                                    "children": [
                                        [
                                            "id": "441c1433-446b-4682-854d-5d795ef52709",
                                            "type": "Button",
                                            "view": [
                                                "content": [
                                                    "title": "",
                                                    "label": buttonLabel
                                                ]
                                            ],
                                            "actions": [[
                                                "condition": "",
                                                "false": "",
                                                "true": "navigate:74a49d4b-2176-4925-857a-e29e2991f1bd:82cae120-c7b1-4c29-bd42-e1521320b109"
                                            ]]
                                        ],
                                        [
                                            "id": "c1ad8812-a824-4ca2-bb27-5bc840ae7e08",
                                            "type": "Button",
                                            "view": [
                                                "content": [
                                                    "title": "",
                                                    "label": "Create"
                                                ]
                                            ],
                                            "actions": [[
                                                "condition": "",
                                                "false": "",
                                                "true": "navigate:ca47e6c5-da19-4491-8422-adb40d9e8a27:306ed62c-c2af-4652-a873-26c7a388972d"
                                            ]]
                                        ]
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ]
        ]
    }

    private func createConditionalFlowData(buttonLabel: String) -> [String: Any] {
        var flowData = createHomeFlowData(buttonLabel: buttonLabel)
        guard var pages = flowData["pages"] as? [[String: Any]],
              var homePage = pages.first,
              var rows = homePage["rows"] as? [[String: Any]],
              var firstRow = rows.first,
              var rowView = firstRow["view"] as? [String: Any],
              var rowContent = rowView["content"] as? [String: Any],
              var children = rowContent["children"] as? [[String: Any]],
              var firstButton = children.first,
              var actions = firstButton["actions"] as? [[String: Any]],
              var firstAction = actions.first else {
            return flowData
        }

        firstAction["condition"] = "{1 > 0 || (0 > 1 && 2 > 3)}"
        actions[0] = firstAction
        firstButton["actions"] = actions
        children[0] = firstButton
        rowContent["children"] = children
        rowView["content"] = rowContent
        firstRow["view"] = rowView
        rows[0] = firstRow
        homePage["rows"] = rows
        pages[0] = homePage
        flowData["pages"] = pages
        return flowData
    }
}

// MARK: - Error / unreachable API

final class E2EErrorStateTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["API_HOST"] = "127.0.0.1:59998"
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
        try super.tearDownWithError()
    }

    func testUnreachableAPIShowsErrorState() throws {
        let failedMessage = app.staticTexts["Failed to load flows"]
        XCTAssertTrue(
            failedMessage.waitForExistence(timeout: 5),
            "User-visible copy should mention failed flow load"
        )
        let retryMessage = app.staticTexts["Please check your connection and try again"]
        XCTAssertTrue(
            retryMessage.exists,
            "User-visible copy should explain how to recover from a failed flow load"
        )
    }
}

