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
    let action = UI_RowAction(condition: "", false: "", true: "{close()}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertEqual(received, .close)
  }

  func testBareCloseActionIsInert() {
    var received: NavOperation?
    let action = UI_RowAction(condition: "", false: "", true: "close")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertNil(received)
  }

  func testUnwrappedCloseFunctionIsInert() {
    var received: NavOperation?
    let action = UI_RowAction(condition: "", false: "", true: "close()")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertNil(received)
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
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate, got \(String(describing: received))")
      return
    }
    XCTAssertEqual(route.flowId, "flow-1")
    XCTAssertEqual(route.pageId, "page-2")
    XCTAssertEqual(route.query, [:])
  }

  func testNavigateWithBraceFunctionAndJsonQueryArgument() {
    var received: NavOperation?
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flow-1,page-2,{\"items\": [\"id-1\", \"id-2\"]})}",
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate, got \(String(describing: received))")
      return
    }
    XCTAssertEqual(route.flowId, "flow-1")
    XCTAssertEqual(route.pageId, "page-2")
    XCTAssertEqual(route.query["items"], ["id-1", "id-2"])
  }

  func testNavigateNonJsonQueryArgumentPostsError() {
    var received: NavOperation?
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flow-1,page-2,notJson)}",
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    wait(for: [expectation], timeout: 2)
    XCTAssertNil(received)
  }

  func testHighlightRequiredFormatsFieldLabel() {
    var received: NavOperation?
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{highlight_required(unit_price)}",
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .highlightRequired(let label) = received else {
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

  func testNavigateWithDatumResolvesId() {
    var received: NavOperation?
    let datum = EVYJson.dictionary([
      "id": .string("resolved-uuid"),
      "title": .string("Test Item"),
    ])
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flowX,pageY,{\"items\": [$datum.id]})}",
    )
    EVYActionRunner.run(actions: [action], datum: datum) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.flowId, "flowX")
    XCTAssertEqual(route.pageId, "pageY")
    XCTAssertEqual(route.query["items"], ["resolved-uuid"])
  }

  func testNavigateWithoutDatumKeepsDatumExpression() {
    var received: NavOperation?
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flowX,pageY,{\"items\": [$datum.id]})}",
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.query["items"], ["$datum.id"])
  }
}
