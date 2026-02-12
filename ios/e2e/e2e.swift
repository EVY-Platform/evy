//
//  e2e.swift
//  evyUITests
//
//  End-to-end UI tests for EVY iOS app
//  All tests run in a single app instance for efficiency
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
            "resource": "SDUI",
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

// MARK: - E2E UI Tests

final class evyUITests: XCTestCase {

    var app: XCUIApplication!
    
    /// Helper to clear text field content and type new text
    private func clearAndType(field: XCUIElement, text: String) {
        // Try to select all and delete existing text
        if let existingText = field.value as? String, !existingText.isEmpty {
            // Triple tap to select all text
            field.tap(withNumberOfTaps: 3, numberOfTouches: 1)
            // Small delay to ensure selection
            Thread.sleep(forTimeInterval: 0.3)
            field.typeText(XCUIKeyboardKey.delete.rawValue)
        }
        field.typeText(text)
    }
    
    /// Helper to find a text field by accessibility identifier across all element types
    private func findElement(identifier: String) -> XCUIElement? {
        // Try as otherElement first (most common for SwiftUI containers)
        let otherElement = app.otherElements[identifier].firstMatch
        if otherElement.waitForExistence(timeout: 2) {
            return otherElement
        }
        
        // Try as a generic descendant - use firstMatch to handle multiple matches
        let descendant = app.descendants(matching: .any)[identifier].firstMatch
        if descendant.waitForExistence(timeout: 2) {
            return descendant
        }
        
        return nil
    }
    
    /// Helper to tap a text field container and return the editable field
    private func tapAndGetEditableField(container: XCUIElement) -> XCUIElement? {
        container.tap()
        
        // Wait a moment for the edit mode to activate
        Thread.sleep(forTimeInterval: 0.5)
        
        // In SwiftUI, the TextField might become a child or the container itself becomes editable
        // Try to find the text field within the container first
        let textField = container.textFields.firstMatch
        if textField.exists {
            return textField
        }
        
        // Fallback: try to find the first focused text field in the app
        let anyTextField = app.textFields.firstMatch
        if anyTextField.waitForExistence(timeout: 2) {
            return anyTextField
        }
        
        return nil
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["API_HOST"] = ProcessInfo.processInfo.environment["API_HOST"] ?? "localhost:8000"
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    /// Single comprehensive e2e test that verifies all functionality in one app instance
    /// This avoids the overhead of restarting the iOS app for each test case
    func testFullE2EFlow() throws {
        // MARK: - App Launch Verification
        XCTAssertTrue(app.exists, "App should launch successfully")
        
        let loadingIndicator = app.progressIndicators["loadingIndicator"]
        let homePage = app.scrollViews["page_55e427ac-263c-441f-9673-f60627b1baea"]
        
        let initialUIAppeared = loadingIndicator.waitForExistence(timeout: 5) || homePage.waitForExistence(timeout: 5)
        XCTAssertTrue(initialUIAppeared || app.buttons.count > 0 || app.staticTexts.count > 0, 
                      "App should display initial UI after launch")

        // MARK: - API Connection & Home Screen
        let viewItemButton = app.buttons["View Item"]
        let createItemButton = app.buttons["Create Item"]

        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20), 
                      "Home screen not loaded - verify API is running and database is seeded")
        XCTAssertTrue(createItemButton.exists, "Create Item button should be visible")

        // MARK: - View Item Flow Navigation
        viewItemButton.tap()

        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after tapping View Item")
        XCTAssertFalse(viewItemButton.exists, "Home buttons should not be visible after navigation")

        let backButton = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()

        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")

        // MARK: - Create Item Flow Navigation
        createItemButton.tap()

        XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after navigation")
        XCTAssertFalse(createItemButton.exists, "Home buttons should not be visible after navigation")

        // MARK: - Text Input Editing
        // Test editing the title input field
        guard let titleTextField = findElement(identifier: "textField_{item.title}") else {
            XCTFail("Title text field should exist with identifier 'textField_{item.title}'")
            return
        }
        
        // Tap to start editing and get the editable field
        guard let titleField = tapAndGetEditableField(container: titleTextField) else {
            XCTFail("Failed to get editable title field")
            return
        }
        
        // Clear and type new text
        let testTitle = "Test Item Title"
        clearAndType(field: titleField, text: testTitle)
        
        // Verify text was entered
        let textFieldValue = titleField.value as? String ?? ""
        XCTAssertTrue(textFieldValue.contains("Test") || textFieldValue.contains("Item"), 
                      "Text field should contain typed text, got: '\(textFieldValue)'")
        
        // Dismiss keyboard by tapping outside
        scrollView.tap()
        
        // Wait for keyboard to dismiss
        Thread.sleep(forTimeInterval: 0.5)
        
        // Test editing the price input field
        guard let priceTextField = findElement(identifier: "textField_{item.price.value}") else {
            XCTFail("Price text field should exist with identifier 'textField_{item.price.value}'")
            return
        }
        
        guard let priceField = tapAndGetEditableField(container: priceTextField) else {
            XCTFail("Failed to get editable price field")
            return
        }
        
        // Clear and type a price value
        clearAndType(field: priceField, text: "99")
        
        // Verify price was entered
        let priceValue = priceField.value as? String ?? ""
        XCTAssertTrue(priceValue.contains("99"), 
                      "Price field should contain typed value, got: '\(priceValue)'")
        
        // Dismiss keyboard
        scrollView.tap()
        Thread.sleep(forTimeInterval: 0.5)
        
        // Test dimension input field (width)
        guard let widthTextField = findElement(identifier: "textField_{item.dimensions.width}") else {
            XCTFail("Width text field should exist with identifier 'textField_{item.dimensions.width}'")
            return
        }
        
        guard let widthField = tapAndGetEditableField(container: widthTextField) else {
            XCTFail("Failed to get editable width field")
            return
        }
        
        // Clear and type a dimension value
        clearAndType(field: widthField, text: "50")
        
        // Verify dimension was entered
        let widthValue = widthField.value as? String ?? ""
        XCTAssertTrue(widthValue.contains("50"), 
                      "Width field should contain typed value, got: '\(widthValue)'")
        
        // Dismiss keyboard
        scrollView.tap()

        // MARK: - Return to Home
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()

        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen after create flow")
    }
    
    /// Test that WebSocket notifications from the API update the iOS UI in real-time
    /// The iOS app has its own WebSocket listener - we just emit updates and verify UI changes
    @MainActor
    func testWebSocketNotificationUpdatesUI() async throws {
        // MARK: - Setup: Wait for app to load and connect to API
        let viewItemButton = app.buttons["View Item"]
        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 20),
                      "Home screen not loaded - verify API is running and database is seeded")
        
        let originalLabel = "View Item"
        let updatedLabel = "Updated View \(Int(Date().timeIntervalSince1970))"
        
        // MARK: - Connect to API and emit update
        let apiHost = ProcessInfo.processInfo.environment["API_HOST"] ?? "localhost:8000"
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
        
        // MARK: - Verify iOS app's UI updates via its own WebSocket listener
        let updatedButton = app.buttons[updatedLabel]
        XCTAssertTrue(updatedButton.waitForExistence(timeout: 10),
                      "Button should update to '\(updatedLabel)' after notification")
        XCTAssertFalse(viewItemButton.exists, "Original button should be replaced")
        
        // Cleanup: restore original
        try? await emitter.updateSDUI(
            flowData: createHomeFlowData(buttonLabel: originalLabel),
            flowId: "f267c629-2594-4770-8cec-d5324ebb4058"
        )
        await emitter.disconnect()
    }
    
    /// Helper to create the Home flow data structure with a custom button label
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
                                            "action": [
                                                "target": "navigate:74a49d4b-2176-4925-857a-e29e2991f1bd:82cae120-c7b1-4c29-bd42-e1521320b109"
                                            ]
                                        ],
                                        [
                                            "id": "c1ad8812-a824-4ca2-bb27-5bc840ae7e08",
                                            "type": "Button",
                                            "view": [
                                                "content": [
                                                    "title": "",
                                                    "label": "Create Item"
                                                ]
                                            ],
                                            "action": [
                                                "target": "navigate:ca47e6c5-da19-4491-8422-adb40d9e8a27:306ed62c-c2af-4652-a873-26c7a388972d"
                                            ]
                                        ]
                                    ]
                                ]
                            ],
                            "edit": [
                                "validation": [
                                    "required": "false"
                                ]
                            ]
                        ]
                    ]
                ]
            ]
        ]
    }
}
