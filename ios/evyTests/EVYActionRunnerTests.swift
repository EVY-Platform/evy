//
//  EVYActionRunnerTests.swift
//  evyTests
//

import XCTest
@testable import evy

@MainActor
final class EVYActionRunnerTests: XCTestCase {
    func testCloseAction() {
        var received: NavOperation?
        let action = UI_RowAction(condition: "", false: "", true: "{close}")
        EVYActionRunner.run(actions: [action]) { received = $0 }
        XCTAssertEqual(received, .close)
    }

    func testCreateAction() {
        var received: NavOperation?
        let action = UI_RowAction(condition: "", false: "", true: "{create(item)}")
        EVYActionRunner.run(actions: [action]) { received = $0 }
        XCTAssertEqual(received, .create("item"))
    }

    func testNavigateWithBraceFunction() {
        var received: NavOperation?
        let action = UI_RowAction(
            condition: "",
            false: "",
            true: "{navigate(flow-1,page-2)}",
        )
        EVYActionRunner.run(actions: [action]) { received = $0 }
        guard case let .navigate(route) = received else {
            XCTFail("Expected navigate, got \(String(describing: received))")
            return
        }
        XCTAssertEqual(route.flowId, "flow-1")
        XCTAssertEqual(route.pageId, "page-2")
    }

    func testNavigateColonFormat() {
        var received: NavOperation?
        let action = UI_RowAction(
            condition: "",
            false: "",
            true: "navigate:flowX:pageY",
        )
        EVYActionRunner.run(actions: [action]) { received = $0 }
        guard case let .navigate(route) = received else {
            XCTFail("Expected navigate")
            return
        }
        XCTAssertEqual(route.flowId, "flowX")
        XCTAssertEqual(route.pageId, "pageY")
    }

    func testHighlightRequiredFormatsFieldLabel() {
        var received: NavOperation?
        let action = UI_RowAction(
            condition: "",
            false: "",
            true: "{highlight_required(unit_price)}",
        )
        EVYActionRunner.run(actions: [action]) { received = $0 }
        guard case let .highlightRequired(label) = received else {
            XCTFail("Expected highlightRequired")
            return
        }
        XCTAssertTrue(label.contains("unit") || label.contains("Unit"))
    }

    func testUnsupportedFunctionPostsErrorNotification() {
        let expectation = expectation(
            forNotification: Notification.Name.evyErrorOccurred,
            object: nil,
        )
        let action = UI_RowAction(
            condition: "",
            false: "",
            true: "{notARealEvyFunction()}",
        )
        EVYActionRunner.run(actions: [action]) { _ in }
        wait(for: [expectation], timeout: 2)
    }
}
