//
//  e2e.swift
//  evyUITests
//
//  End-to-end UI tests for EVY iOS app.
//  Two test classes run in parallel (each in its own app instance when parallelised).
//

import XCTest

// MARK: - Minimal WebSocket Emitter for E2E Tests

/// Minimal WebSocket client for sending JSON-RPC commands to the API
/// The iOS app has its own WebSocket listener - this just triggers updates
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
            "namespace": "evy",
            "resource": "sdui",
            "filter": ["id": flowId],
            "data": flowData
        ]
        _ = try await send(method: "upsert", params: params)
    }

    func disconnect() { ws?.cancel(with: .normalClosure, reason: nil) }

    private func send(method: String, params: Any) async throws -> [String: Any] {
        msgId += 1
        let msg: [String: Any] = ["jsonrpc": "2.0", "id": msgId, "method": method, "params": params]
        let json = String(data: try JSONSerialization.data(withJSONObject: msg), encoding: .utf8)!
        try await ws?.send(.string(json))

        // Wait for response
        let result = try await ws?.receive()
        if case .string(let text) = result,
           let data = text.data(using: .utf8),
           let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return response
        }
        return [:]
    }
}

// MARK: - Base class for E2E tests

class E2ETestBase: XCTestCase {

    var app: XCUIApplication!

    /// Helper to clear text field content and type new text
    func clearAndType(field: XCUIElement, text: String) {
        if let existingText = field.value as? String, !existingText.isEmpty {
            field.tap(withNumberOfTaps: 3, numberOfTouches: 1)
            Thread.sleep(forTimeInterval: 0.3)
            field.typeText(XCUIKeyboardKey.delete.rawValue)
        }
        field.typeText(text)
    }

    /// Helper to find a text field by accessibility identifier across all element types
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

    /// Helper to locate elements when exact accessibility identifiers vary slightly.
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

    /// Scroll-aware version of multi-strategy element lookup.
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

    /// Helper to tap a text field container and return the editable field
    func tapAndGetEditableField(container: XCUIElement) -> XCUIElement? {
        container.tap()
        Thread.sleep(forTimeInterval: 0.5)
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

    /// UI visibility and navigation: launch, home, View flow, Create flow (no form editing), back to home.
    func testNavigationAndVisibility() throws {
        // MARK: - App Launch Verification
        XCTAssertTrue(app.exists, "App should launch successfully")

        let loadingIndicator = app.progressIndicators["loadingIndicator"]
        let homePage = app.scrollViews["page_55e427ac-263c-441f-9673-f60627b1baea"]
        let initialUIAppeared = loadingIndicator.waitForExistence(timeout: 5) || homePage.waitForExistence(timeout: 5)
        XCTAssertTrue(initialUIAppeared || app.buttons.count > 0 || app.staticTexts.count > 0,
                      "App should display initial UI after launch")

        // MARK: - API Connection & Home Screen
        let viewItemButton = app.buttons["View"]
        let createItemButton = app.buttons["Create"]
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20),
                      "Home screen not loaded - verify API is running and database is seeded")
        XCTAssertTrue(createItemButton.exists, "Create button should be visible")

        // MARK: - View Item Flow Navigation
        viewItemButton.tap()
        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after tapping View")
        XCTAssertFalse(viewItemButton.exists, "Home buttons should not be visible after navigation")

        // MARK: - Footer Visibility
        let goHomeButton = app.buttons["Go home"]
        XCTAssertTrue(goHomeButton.waitForExistence(timeout: 5), "Footer 'Go home' button should be visible")

        let backButton = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")

        // MARK: - Create Item Flow Navigation
        createItemButton.tap()
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after navigation")
        XCTAssertFalse(createItemButton.exists, "Home buttons should not be visible after navigation")

        // MARK: - Return to Home (no form editing)
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen after create flow")
    }
}

// MARK: - WebSocket and form data editing

final class WebSocketE2ETests: E2ETestBase {

    /// Test that WebSocket notifications from the API update the iOS UI in real-time.
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

    /// Form data editing: navigate to Create, edit title/price/width, verify, return to home.
    func testCreateItemFormEditing() throws {
        let viewItemButton = app.buttons["View"]
        let createItemButton = app.buttons["Create"]
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20),
                      "Home screen not loaded - verify API is running and database is seeded")
        createItemButton.tap()

        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after navigation")

        // Title field
        guard let titleTextField = findElement(identifier: "textField_{title}") else {
            XCTFail("Title text field should exist with identifier 'textField_{title}'")
            return
        }
        guard let titleField = tapAndGetEditableField(container: titleTextField) else {
            XCTFail("Failed to get editable title field")
            return
        }
        let testTitle = "Test Item Title"
        clearAndType(field: titleField, text: testTitle)
        let textFieldValue = titleField.value as? String ?? ""
        XCTAssertTrue(textFieldValue.contains("Test") || textFieldValue.contains("Item"),
                      "Text field should contain typed text, got: '\(textFieldValue)'")
        scrollView.tap()
        Thread.sleep(forTimeInterval: 0.5)

        // Price field (optional)
        if let priceTextField = findElementWithScroll(
            identifiers: ["textField_{price}"],
            containsAny: ["price"],
            in: scrollView
        ), let priceField = tapAndGetEditableField(container: priceTextField) {
            clearAndType(field: priceField, text: "99")
            let priceValue = priceField.value as? String ?? ""
            XCTAssertTrue(priceValue.contains("99"), "Price field should contain typed value, got: '\(priceValue)'")
            scrollView.tap()
            Thread.sleep(forTimeInterval: 0.5)
        } else {
            print("Skipping price field edit: no matching editable field found")
        }

        // Width field (optional)
        if let widthTextField = findElementWithScroll(
            identifiers: ["textField_{width}"],
            containsAny: ["width"],
            in: scrollView
        ), let widthField = tapAndGetEditableField(container: widthTextField) {
            clearAndType(field: widthField, text: "50")
            let widthValue = widthField.value as? String ?? ""
            XCTAssertTrue(widthValue.contains("50"), "Width field should contain typed value, got: '\(widthValue)'")
            scrollView.tap()
        } else {
            print("Skipping width field edit: no matching editable field found")
        }

        let backButton = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen after create flow")
    }

    private func createHomeFlowData(buttonLabel: String) -> [String: Any] {
        return [
            "id": "f267c629-2594-4770-8cec-d5324ebb4058",
            "name": "Home",
            "type": "read",
            "data": "",
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
}
