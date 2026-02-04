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
        XCTAssertTrue(app.exists, "App should launch successfully")
        
        let loadingIndicator = app.progressIndicators["loadingIndicator"]
        let homeStack = app.otherElements["homeButtonsStack"]
        
        let initialUIAppeared = loadingIndicator.waitForExistence(timeout: 5) || homeStack.waitForExistence(timeout: 5)
        XCTAssertTrue(initialUIAppeared || app.buttons.count > 0 || app.staticTexts.count > 0, 
                      "App should display initial UI after launch")
    }
    
    func testFullFlowNavigation() throws {
        // MARK: - App Launch & Home Screen

        XCTAssertTrue(app.exists, "App should launch successfully")

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
    
    func testAPIConnection() throws {
        XCTAssertTrue(app.exists, "App should launch successfully")
        
        let viewItemButton = app.buttons["View Item"]
        let apiConnected = viewItemButton.waitForExistence(timeout: 15)
        
        XCTAssertTrue(apiConnected, "App should load flows from API - verify API is running and database is seeded")
    }
}
