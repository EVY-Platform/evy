//
//  evyUITests.swift
//  evyUITests
//
//  End-to-end UI tests for EVY iOS app
//

import XCTest

final class evyUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["API_HOST"] = ProcessInfo.processInfo.environment["API_HOST"] ?? "127.0.0.1:8000"
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testEndToEndFlow() throws {
        // MARK: - App Launch & Home Screen

        XCTAssertTrue(app.exists, "App should launch successfully")

        // Plain-styled buttons are found by label text
        let viewItemButton = app.buttons["View Item"]
        let createItemButton = app.buttons["Create Item"]

        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 15), "View Item button should appear after flows load")
        XCTAssertTrue(createItemButton.exists, "Create Item button should be visible")

        // MARK: - View Item Flow Navigation

        viewItemButton.tap()

        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.waitForExistence(timeout: 5), "Should navigate to a page with scrollable content")
        XCTAssertFalse(app.buttons["View Item"].exists, "Home buttons should not be visible after navigation")

        // Verify navigation bar exists
        let navBar = app.navigationBars.firstMatch
        XCTAssertTrue(navBar.exists, "Navigation bar should exist on page")

        // Navigate back to home
        let backButton = app.navigationBars.buttons.firstMatch
        XCTAssertTrue(backButton.exists, "Back button should exist")
        backButton.tap()

        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")

        // MARK: - Create Item Flow with Text Input

        createItemButton.tap()

        XCTAssertTrue(scrollView.waitForExistence(timeout: 5), "Create flow page should load")
        XCTAssertFalse(app.buttons["Create Item"].exists, "Home buttons should not be visible")

        // Verify page has content
        let hasContent = app.textFields.count > 0 || app.staticTexts.count > 0
        XCTAssertTrue(hasContent, "Page should have text content")

        // Try to interact with text fields if available
        let textFields = app.textFields.allElementsBoundByIndex
        if textFields.count > 0 {
            let firstTextField = textFields[0]
            firstTextField.tap()
            firstTextField.typeText("Test Input")
        }

        // Navigate back to home
        backButton.tap()

        XCTAssertTrue(createItemButton.waitForExistence(timeout: 5), "Should return to home screen after create flow")
    }
}
