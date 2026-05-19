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
    let action = UI_RowAction(condition: "", false: "", true: "{create(marketplace,items)}")
    EVYActionRunner.run(actions: [action]) { received = $0 }
    XCTAssertEqual(received, .create(namespace: "marketplace", resource: "items"))
  }

  func testShowActionPresentsChild() throws {
    let row = try makeRowWithChild()
    var shownRow: UI_Row?
    let action = UI_RowAction(condition: "", false: "", true: "{show()}")
    EVYActionRunner.run(actions: [action], row: row, show: { shownRow = $0 }) { _ in }
    XCTAssertEqual(shownRow?.id, "child-row")
  }

  func testShowActionWithoutChildIsNoOp() throws {
    let row = try makeRowWithoutChild()
    var shownRow: UI_Row?
    let action = UI_RowAction(condition: "", false: "", true: "{show()}")
    EVYActionRunner.run(actions: [action], row: row, show: { shownRow = $0 }) { _ in }
    XCTAssertNil(shownRow)
  }

  func testFalseBranchShowActionPresentsChild() throws {
    let row = try makeRowWithChild()
    var shownRow: UI_Row?
    let action = UI_RowAction(condition: "{false}", false: "{show()}", true: "")
    EVYActionRunner.run(actions: [action], row: row, show: { shownRow = $0 }) { _ in }
    XCTAssertEqual(shownRow?.id, "child-row")
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
      true: "{navigate(flowX,pageY,{\"items\": \"$datum.id\"})}",
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

  func testNavigateWithUnquotedDatumInQueryPostsError() {
    var received: NavOperation?
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    let datum = EVYJson.dictionary([
      "id": .string("resolved-uuid"),
      "title": .string("Test"),
    ])
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flowX,pageY,{\"id\": $datum.id})}",
    )
    EVYActionRunner.run(actions: [action], datum: datum) { received = $0 }
    wait(for: [expectation], timeout: 2)
    XCTAssertNil(received)
  }

  func testNavigateWithCommaInQueryJson() {
    var received: NavOperation?
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flowX,pageY,{\"items\": [\"a\"], \"kind\": \"item\"})}",
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.query["items"], ["a"])
    XCTAssertEqual(route.query["kind"], ["item"])
  }

  func testNavigateWithTooManyArgsThrowsError() {
    let expectation = expectation(
      forNotification: Notification.Name.evyErrorOccurred,
      object: nil,
    )
    // Fourth top-level argument triggers the "at most 3" guard
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flowX,pageY,{\"key\": \"val\"},extra)}",
    )
    EVYActionRunner.run(actions: [action]) { _ in }
    wait(for: [expectation], timeout: 2)
  }

  func testNavigateWithoutDatumKeepsDatumExpression() {
    var received: NavOperation?
    let action = UI_RowAction(
      condition: "",
      false: "",
      true: "{navigate(flowX,pageY,{\"items\": \"$datum.id\"})}",
    )
    EVYActionRunner.run(actions: [action]) { received = $0 }
    guard case .navigate(let route) = received else {
      XCTFail("Expected navigate")
      return
    }
    XCTAssertEqual(route.query["items"], ["$datum.id"])
  }

  func testDatumRowFormatterDoesNotResolveDatumInActions() throws {
    let actionString = "{navigate(flowX,pageY,{\"id\": \"$datum.id\"})}"
    let row = try decodeRow(
      content: """
        {
          "title": "{$datum.title}"
        }
        """,
      actions: [UI_RowAction(condition: "", false: "", true: actionString)]
    )
    let formatter = try EVYDatumRowFormatter(template: row)
    let datum = EVYJson.dictionary([
      "id": .string("resolved-uuid"),
      "title": .string("Resolved Title"),
    ])

    let formattedRow = try formatter.formattedResult(datum: datum).row

    XCTAssertEqual(formattedRow.view.content.title, "Resolved Title")
    XCTAssertEqual(formattedRow.actions.first?.true, actionString)
  }

  private func makeRowWithChild() throws -> UI_Row {
    try decodeRow(
      content: """
        {
          "title": "",
          "label": "Show child",
          "child": {
            "id": "child-row",
            "type": "Text",
            "source": "",
            "destination": "",
            "view": { "content": { "title": "Child", "text": "Body" }, "max_lines": "" },
            "actions": []
          }
        }
        """
    )
  }

  private func makeRowWithoutChild() throws -> UI_Row {
    try decodeRow(
      content: """
        { "title": "", "label": "No child" }
        """
    )
  }

  private func decodeRow(
    content: String,
    actions: [UI_RowAction] = []
  ) throws -> UI_Row {
    let actionsData = try JSONEncoder().encode(actions)
    let actionsJson = try XCTUnwrap(String(data: actionsData, encoding: .utf8))
    let json = """
      {
        "id": "parent-row",
        "type": "Button",
        "source": "",
        "destination": "",
        "view": { "content": \(content) },
        "actions": \(actionsJson)
      }
      """
    let data = try XCTUnwrap(json.data(using: .utf8))
    return try JSONDecoder().decode(UI_Row.self, from: data)
  }
}
