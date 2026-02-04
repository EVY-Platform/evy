//
//  e2e.swift
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
        app.launchEnvironment["API_HOST"] = ProcessInfo.processInfo.environment["API_HOST"] ?? "localhost:8000"
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testAppLaunches() throws {
        // Verify app launches successfully
        XCTAssertTrue(app.exists, "App should launch successfully")
        
        // Wait for initial UI to appear (loading indicator or home content)
        let loadingIndicator = app.progressIndicators["loadingIndicator"]
        let homeStack = app.otherElements["homeButtonsStack"]
        
        // Either loading indicator or home content should appear
        let initialUIAppeared = loadingIndicator.waitForExistence(timeout: 5) || homeStack.waitForExistence(timeout: 5)
        XCTAssertTrue(initialUIAppeared || app.buttons.count > 0 || app.staticTexts.count > 0, 
                      "App should display initial UI after launch")
    }
    
    /// This test requires specific flows to be loaded from the API.
    /// The database must be seeded with "View Item" and "Create item" flows.
    func testFullFlowNavigation() throws {
        // MARK: - App Launch & Home Screen

        XCTAssertTrue(app.exists, "App should launch successfully")

        // Wait for flows to load - these buttons come from the API
        let viewItemButton = app.buttons["View Item"]
        let createItemButton = app.buttons["Create item"]

        // If flows are not available, skip this test
        // This is acceptable in e2e when database is empty
        try XCTSkipUnless(viewItemButton.waitForExistence(timeout: 15), 
                          "Flows not loaded from API - skipping full flow test (seed database to enable)")
        
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
        XCTAssertFalse(app.buttons["Create item"].exists, "Home buttons should not be visible")

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
    
    func testAPIConnection() throws {
        // Verify app launches and successfully connects to API
        XCTAssertTrue(app.exists, "App should launch successfully")
        
        // Wait for flows to load from API - if any button appears, API connection succeeded
        let viewItemButton = app.buttons["View Item"]
        let apiConnected = viewItemButton.waitForExistence(timeout: 15)
        
        XCTAssertTrue(apiConnected, "App should load flows from API - verify API is running and database is seeded")
    }
}
