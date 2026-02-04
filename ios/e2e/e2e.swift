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

        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
        backButton.tap()

        XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen after create flow")
    }
}
