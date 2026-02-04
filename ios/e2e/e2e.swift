//
//  e2e.swift
//  evyUITests
//
//  End-to-end UI tests for EVY iOS app
//  All tests run in a single app instance for efficiency
//

import XCTest

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
}
