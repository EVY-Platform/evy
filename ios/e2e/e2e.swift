//
//  e2e.swift
//  evyUITests
//

import XCTest

private let MARKETPLACE_ITEMS_RESOURCE_ID = MarketplaceResource.items.rawValue

// MARK: - Minimal WebSocket Emitter for E2E Tests

actor WSEmitter {
  private var ws: URLSessionWebSocketTask?
  private var msgId = 0

  func connect(host: String) async throws {
    let url = URL(string: "ws://\(host)")!
    ws = URLSession.shared.webSocketTask(with: url)
    ws?.resume()
    try await Task.sleep(nanoseconds: 300_000_000)  // 0.3s for connection
  }

  func login(token: String, os: String) async throws {
    let response = try await send(method: "rpc.login", params: ["token": token, "os": os])
    guard response["result"] as? Bool == true else {
      throw NSError(
        domain: "WSEmitter", code: 1, userInfo: [NSLocalizedDescriptionKey: "Login failed"])
    }
  }

  func applySDUI(flowData: [String: Any], flowId: String) async throws {
    try await saveFlowGraph(flowData: flowData, flowId: flowId)
  }

  func updateSDUI(flowData: [String: Any], flowId: String) async throws {
    try await saveFlowGraph(flowData: flowData, flowId: flowId)
  }

  private func saveFlowGraph(flowData: [String: Any], flowId: String) async throws {
    let graph = decomposeFlow(flowData: flowData, flowId: flowId)
    for row in graph.rows {
      try await upsertResource(resource: EVYCoreResource.rows.rawValue, id: row.id, data: row.data)
    }
    for page in graph.pages {
      try await upsertResource(
        resource: EVYCoreResource.pages.rawValue, id: page.id, data: page.data)
    }
    try await upsertResource(
      resource: EVYCoreResource.flows.rawValue,
      id: graph.flow.id,
      data: graph.flow.data
    )
  }

  private func upsertResource(resource: String, id: String, data: [String: Any]) async throws {
    let existing = try await getResource(
      service: EVY_CORE_SERVICE,
      resource: resource,
      filter: ["id": id]
    )
    let existingArray = existing as? [Any]
    let method = existingArray?.isEmpty == false ? "update" : "create"
    let params: [String: Any] = [
      "service": EVY_CORE_SERVICE,
      "resource": resource,
      "filter": ["id": id],
      "data": data,
    ]
    _ = try await send(method: method, params: params)
  }

  private func decomposeFlow(flowData: [String: Any], flowId: String) -> (
    flow: (id: String, data: [String: Any]),
    pages: [(id: String, data: [String: Any])],
    rows: [(id: String, data: [String: Any])]
  ) {
    let now = ISO8601DateFormatter().string(from: Date())
    var rows: [(id: String, data: [String: Any])] = []
    let pagesInput = flowData["pages"] as? [[String: Any]] ?? []
    let pages = pagesInput.map { pageData in
      decomposePage(pageData: pageData, rows: &rows, now: now)
    }
    let flowRow: [String: Any] = [
      "id": flowId,
      "name": nonEmptyString(flowData["name"]) ?? "Flow",
      "pageIds": pages.map(\.id),
      "createdAt": now,
      "updatedAt": now,
    ]
    return ((flowId, flowRow), pages, rows)
  }

  private func decomposePage(
    pageData: [String: Any],
    rows: inout [(id: String, data: [String: Any])],
    now: String
  ) -> (id: String, data: [String: Any]) {
    let pageId = (pageData["id"] as? String) ?? UUID().uuidString
    let rowInputs = pageData["rows"] as? [[String: Any]] ?? []
    let rowIds = rowInputs.map { rowData in
      decomposeRow(rowData: rowData, rows: &rows, now: now)
    }
    let footerRowId = (pageData["footer"] as? [String: Any]).map { footerData in
      decomposeRow(rowData: footerData, rows: &rows, now: now)
    }
    var pageRow: [String: Any] = [
      "id": pageId,
      "name": nonEmptyString(pageData["name"]) ?? nonEmptyString(pageData["title"]) ?? "Page",
      "title": (pageData["title"] as? String) ?? "",
      "rowIds": rowIds,
      "createdAt": now,
      "updatedAt": now,
    ]
    if let footerRowId { pageRow["footerRowId"] = footerRowId }
    return (pageId, pageRow)
  }

  private func decomposeRow(
    rowData: [String: Any],
    rows: inout [(id: String, data: [String: Any])],
    now: String
  ) -> String {
    let rowId = (rowData["id"] as? String) ?? UUID().uuidString
    var data = rowData
    for key in ["id", "name", "type", "visible", "child", "children"] {
      data.removeValue(forKey: key)
    }
    if let child = rowData["child"] as? [String: Any] {
      data["child_row_id"] = decomposeRow(rowData: child, rows: &rows, now: now)
    }
    if let children = rowData["children"] as? [[String: Any]], !children.isEmpty {
      data["children_row_ids"] = children.map { child in
        decomposeRow(rowData: child, rows: &rows, now: now)
      }
    }
    let row: [String: Any] = [
      "id": rowId,
      "name": nonEmptyString(rowData["name"]) ?? nonEmptyString(rowData["title"])
        ?? nonEmptyString(rowData["type"]) ?? "Row",
      "type": (rowData["type"] as? String) ?? "Text",
      "visible": (rowData["visible"] as? String) ?? "true",
      "data": data,
      "createdAt": now,
      "updatedAt": now,
    ]
    rows.append((rowId, row))
    return rowId
  }

  private func nonEmptyString(_ value: Any?) -> String? {
    guard let string = value as? String, !string.isEmpty else { return nil }
    return string
  }

  func getResource(service: String, resource: String, filter: [String: Any]? = nil) async throws
    -> Any
  {
    var params: [String: Any] = ["service": service, "resource": resource]
    if let filter = filter {
      params["filter"] = filter
    }
    return try await rpcResult(method: "get", params: params)
  }

  func createResource(
    service: String,
    resource: String,
    filter: [String: Any]? = nil,
    data: [String: Any]
  ) async throws -> Any {
    var params: [String: Any] = ["service": service, "resource": resource, "data": data]
    if let filter = filter {
      params["filter"] = filter
    }
    return try await rpcResult(method: "create", params: params)
  }

  private func rpcResult(method: String, params: Any) async throws -> Any {
    let response = try await send(method: method, params: params)
    guard let result = response["result"] else {
      throw NSError(
        domain: "WSEmitter",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "\(method) response missing result"]
      )
    }
    return result
  }

  func disconnect() { ws?.cancel(with: .normalClosure, reason: nil) }

  private func send(method: String, params: Any) async throws -> [String: Any] {
    msgId += 1
    let msg: [String: Any] = ["jsonrpc": "2.0", "id": msgId, "method": method, "params": params]
    let json = String(data: try JSONSerialization.data(withJSONObject: msg), encoding: .utf8)!
    try await ws?.send(.string(json))

    while true {
      let result = try await ws?.receive()
      guard case .string(let text) = result,
        let data = text.data(using: .utf8),
        let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else {
        return [:]
      }
      if response["id"] == nil { continue }
      if let error = response["error"] as? [String: Any] {
        let message = (error["message"] as? String) ?? "JSON-RPC error"
        let details = (error["data"] as? String).map { ": \($0)" } ?? ""
        throw NSError(
          domain: "WSEmitter",
          code: (error["code"] as? Int) ?? -1,
          userInfo: [NSLocalizedDescriptionKey: "\(method) failed: \(message)\(details)"]
        )
      }
      return response
    }
  }
}

private enum E2EFlowIds {
  static let navigationHomeFlow = "10000000-0000-4000-8000-000000000001"
  static let navigationViewFlow = "10000000-0000-4000-8000-000000000007"
  static let navigationViewPage = "10000000-0000-4000-8000-000000000008"
  static let webSocketHomeFlow = "10000000-0000-4000-8000-000000000002"
  static let webSocketViewFlow = "10000000-0000-4000-8000-000000000003"
  static let webSocketViewPage = "10000000-0000-4000-8000-000000000004"
  static let webSocketCreateFlow = "10000000-0000-4000-8000-000000000005"
  static let webSocketCreatePage = "10000000-0000-4000-8000-000000000006"
}

// MARK: - Base class for E2E tests

class E2ETestBase: XCTestCase {

  var app: XCUIApplication!

  static func minimalCreateItemFlowData() -> [String: Any] {
    [
      "id": E2EFlowIds.webSocketCreateFlow,
      "name": "Create item",
      "pages": [
        [
          "id": E2EFlowIds.webSocketCreatePage,
          "title": "Create listing",
          "rows": [
            Self.inputRow(
              id: "e0fc5df1-b4bf-4996-87f4-f2b0f3c2a0be",
              title: "Title",
              source: nil,
              placeholder: "Item",
              destination: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
            ),
            Self.inputRow(
              id: "668aeb79-d8ba-43b7-9619-07f91d0a1908",
              title: "Price",
              source: "{formatCurrency(price)}",
              placeholder: "0",
              destination: "{buildCurrency(\(MARKETPLACE_ITEMS_RESOURCE_ID).price)}"
            ),
            Self.inputRow(
              id: "2a9b22a0-b0eb-4648-83ca-77b2b8748816",
              title: "Width",
              source: "{formatDimension(width)}",
              placeholder: "0",
              destination: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).width}"
            ),
          ],
          "footer": Self.buttonRow(
            id: "1cb41189-6fa5-4562-996a-7cefb88a08ca",
            label: "Submit",
            action: "{create(\(MARKETPLACE_SERVICE),\(MARKETPLACE_ITEMS_RESOURCE_ID))}"
          ),
        ]
      ],
    ]
  }

  func clearAndType(field: XCUIElement, text: String, placeholder: String? = nil) {
    if let existingText = field.value as? String, !existingText.isEmpty {
      let shouldClearExistingText = placeholder == nil || existingText != placeholder
      if shouldClearExistingText {
        field.tap()
        field.typeText(
          String(repeating: XCUIKeyboardKey.delete.rawValue, count: existingText.count))
      }
    }
    field.typeText(text)
  }

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

  func findElementWithScroll(
    identifiers: [String],
    containsAny tokens: [String],
    in scrollView: XCUIElement,
    maxScrollAttempts: Int = 6
  ) -> XCUIElement? {
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

  @MainActor func tapAndGetEditableField(container: XCUIElement) async -> XCUIElement? {
    container.tap()
    try? await Task.sleep(for: .milliseconds(500))
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

  var homeFlowId: String? { nil }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try launchApp()
  }

  var apiHost: String { ProcessInfo.processInfo.environment["API_HOST"] ?? "localhost:8000" }

  func launchApp() throws {
    app = XCUIApplication()
    app.launchEnvironment["API_HOST"] = apiHost
    if let homeFlowId {
      app.launchEnvironment["HOME_FLOW_ID"] = homeFlowId
    }
    app.launch()
  }

  func runAsyncOperation(
    _ description: String,
    timeout: TimeInterval = 10,
    operation: @escaping () async throws -> Void
  ) throws {
    let asyncExpectation = expectation(description: description)
    var capturedError: Error?

    Task {
      do {
        try await operation()
      } catch {
        capturedError = error
      }
      asyncExpectation.fulfill()
    }

    wait(for: [asyncExpectation], timeout: timeout)
    if let capturedError {
      throw capturedError
    }
  }

  func seedFlows(_ flows: [(flowId: String, flowData: [String: Any])]) throws {
    try runAsyncOperation("Seed isolated E2E flows", timeout: 15) { [self] in
      let emitter = WSEmitter()
      try await emitter.connect(host: self.apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      for flow in flows {
        try await emitter.applySDUI(flowData: flow.flowData, flowId: flow.flowId)
      }
      await emitter.disconnect()
    }
  }

  static func homeFlowData(
    flowId: String,
    viewFlowId: String,
    viewPageId: String,
    createFlowId: String,
    createPageId: String,
    buttonLabel: String
  ) -> [String: Any] {
    return [
      "id": flowId,
      "name": "E2E Home",
      "pages": [
        [
          "id": "55e427ac-263c-441f-9673-f60627b1baea",
          "title": "Home",
          "rows": [
            [
              "id": "a74bc80e-ffda-4e19-b8f3-cd882405958b",
              "type": "ColumnContainer",
              "actions": [],
              "visible": "true",
              "title": "",
              "children": [
                Self.buttonRow(
                  id: "441c1433-446b-4682-854d-5d795ef52709",
                  label: buttonLabel,
                  action: "{navigate(\(viewFlowId),\(viewPageId))}"
                ),
                Self.buttonRow(
                  id: "c1ad8812-a824-4ca2-bb27-5bc840ae7e08",
                  label: "Create",
                  action: "{navigate(\(createFlowId),\(createPageId))}"
                ),
              ],
            ]
          ],
        ]
      ],
    ]
  }

  static func textRow(
    id: String,
    title: String,
    text: String = "",
    subtitle: String = "",
    visible: String = "true"
  ) -> [String: Any] {
    var row: [String: Any] = [
      "id": id,
      "type": text.isEmpty ? "Text" : "TextExpand",
      "actions": [],
      "visible": visible,
      "title": title,
    ]
    if text.isEmpty {
      row["subtitle"] = subtitle
      row["label"] = ""
    } else {
      row["text"] = text
      row["expandLabel"] = "Read more"
    }
    return row
  }

  static func listItemRow(
    id: String,
    title: String,
    subtitle: String = "",
    image: String = "",
    visible: String = "true"
  ) -> [String: Any] {
    return [
      "id": id,
      "type": "ListItem",
      "actions": [],
      "visible": visible,
      "title": title,
      "subtitle": subtitle,
      "image": image,
    ]
  }

  static func inputRow(
    id: String,
    title: String,
    source: String?,
    placeholder: String,
    destination: String,
    visible: String = "true"
  ) -> [String: Any] {
    var row: [String: Any] = [
      "id": id,
      "type": "Input",
      "visible": visible,
      "title": title,
      "placeholder": placeholder,
      "destination": destination,
      "actions": [],
    ]
    if let source, !source.isEmpty {
      row["source"] = source
    }
    return row
  }

  static func buttonRow(
    id: String,
    label: String,
    action: String,
    visible: String = "true"
  ) -> [String: Any] {
    return [
      "id": id,
      "type": "Button",
      "visible": visible,
      "title": "",
      "label": label,
      "actions": [
        [
          "condition": "",
          "false": "",
          "true": action,
        ]
      ],
    ]
  }

  static func viewItemFlowData(flowId: String, pageId: String) -> [String: Any] {
    return [
      "id": flowId,
      "name": "E2E View Item",
      "pages": [
        [
          "id": pageId,
          "title": "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}",
          "rows": [
            Self.textRow(
              id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
              title: "My item is called",
              text: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
            ),
            Self.textRow(
              id: "d4e5f6a7-b8c9-4012-d345-6789abcdef01",
              title: "App payments accepted",
              visible: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.app == true}"
            ),
            Self.textRow(
              id: "e5f6a7b8-c9d0-4123-e456-789abcdef012",
              title: "Cash accepted",
              visible: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.cash == true}"
            ),
          ],
          "footer": Self.buttonRow(
            id: "4c953f9b-597b-4e0c-82f0-2fe25efefba0",
            label: "Go home",
            action: "{close()}"
          ),
        ]
      ],
    ]
  }

  func createMarketplaceItem(
    emitter: WSEmitter,
    titlePrefix: String,
    paymentMethods: [String: Bool]? = nil
  ) async throws -> (id: String, title: String) {
    let selectedItemId = UUID().uuidString
    let selectedItemTitle = "\(titlePrefix) \(Int(Date().timeIntervalSince1970))"
    var data: [String: Any] = [
      "id": selectedItemId,
      "title": selectedItemTitle,
    ]
    if let paymentMethods {
      data["payment_methods"] = paymentMethods
    }
    _ = try await emitter.createResource(
      service: MARKETPLACE_SERVICE,
      resource: MARKETPLACE_ITEMS_RESOURCE_ID,
      filter: ["id": selectedItemId],
      data: data
    )
    return (selectedItemId, selectedItemTitle)
  }

  override func tearDownWithError() throws {
    app = nil
  }
}

// MARK: - Navigation and visibility only

final class E2EFlowTests: E2ETestBase {
  override var homeFlowId: String? { E2EFlowIds.navigationHomeFlow }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try seedFlows(
      [
        (
          flowId: E2EFlowIds.navigationHomeFlow,
          flowData: Self.homeFlowData(
            flowId: E2EFlowIds.navigationHomeFlow,
            viewFlowId: E2EFlowIds.navigationViewFlow,
            viewPageId: E2EFlowIds.navigationViewPage,
            createFlowId: E2EFlowIds.webSocketCreateFlow,
            createPageId: E2EFlowIds.webSocketCreatePage,
            buttonLabel: "View"
          )
        ),
        (
          flowId: E2EFlowIds.navigationViewFlow,
          flowData: Self.viewItemFlowData(
            flowId: E2EFlowIds.navigationViewFlow,
            pageId: E2EFlowIds.navigationViewPage
          )
        ),
        (
          flowId: E2EFlowIds.webSocketCreateFlow,
          flowData: Self.minimalCreateItemFlowData()
        ),
      ]
    )
    try launchApp()
  }

  func testNavigationAndVisibility() throws {
    XCTAssertTrue(app.exists, "App should launch successfully")

    let loadingIndicator = app.progressIndicators["loadingIndicator"]
    let homePage = app.scrollViews["page_55e427ac-263c-441f-9673-f60627b1baea"]
    let initialUIAppeared =
      loadingIndicator.waitForExistence(timeout: 5) || homePage.waitForExistence(timeout: 5)
    XCTAssertTrue(
      initialUIAppeared || app.buttons.count > 0 || app.staticTexts.count > 0,
      "App should display initial UI after launch")

    let viewItemButton = app.buttons["View"]
    let createItemButton = app.buttons["Create"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")
    XCTAssertTrue(createItemButton.exists, "Create button should be visible")

    viewItemButton.tap()
    let scrollView = app.scrollViews.firstMatch
    XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after tapping View")
    XCTAssertFalse(viewItemButton.exists, "Home buttons should not be visible after navigation")

    let goHomeButton = app.buttons["Go home"]
    XCTAssertTrue(
      goHomeButton.waitForExistence(timeout: 5), "Footer 'Go home' button should be visible")

    let backButton = app.navigationBars.buttons.firstMatch
    XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
    backButton.tap()
    XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")

    createItemButton.tap()
    XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after navigation")
    XCTAssertFalse(createItemButton.exists, "Home buttons should not be visible after navigation")

    XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
    backButton.tap()
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 5), "Should return to home screen after create flow")
  }
}

// MARK: - WebSocket and form data editing

final class WebSocketE2ETests: E2ETestBase {
  override var homeFlowId: String? { E2EFlowIds.webSocketHomeFlow }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try seedIsolatedFlows()
    try launchApp()
  }

  override func tearDownWithError() throws {
    try? seedIsolatedFlows()
    try super.tearDownWithError()
  }

  private func seedIsolatedFlows() throws {
    try seedFlows(
      [
        (
          flowId: E2EFlowIds.webSocketHomeFlow,
          flowData: createHomeFlowData(buttonLabel: "View")
        ),
        (
          flowId: E2EFlowIds.webSocketViewFlow,
          flowData: Self.viewItemFlowData(
            flowId: E2EFlowIds.webSocketViewFlow,
            pageId: E2EFlowIds.webSocketViewPage
          )
        ),
        (
          flowId: E2EFlowIds.webSocketCreateFlow,
          flowData: Self.minimalCreateItemFlowData()
        ),
      ]
    )
  }

  @MainActor
  func testWebSocketNotificationUpdatesUI() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let originalLabel = "View"
    let updatedLabel = "Updated View \(Int(Date().timeIntervalSince1970))"

    let emitter = WSEmitter()
    do {
      try await emitter.connect(host: apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      try await emitter.updateSDUI(
        flowData: createHomeFlowData(buttonLabel: updatedLabel),
        flowId: E2EFlowIds.webSocketHomeFlow
      )
    } catch {
      XCTFail("Failed to emit update: \(error.localizedDescription)")
      return
    }

    let updatedButton = app.buttons[updatedLabel]
    XCTAssertTrue(
      updatedButton.waitForExistence(timeout: 10),
      "Button should update to '\(updatedLabel)' after notification")
    XCTAssertFalse(viewItemButton.exists, "Original button should be replaced")

    try? await emitter.updateSDUI(
      flowData: createHomeFlowData(buttonLabel: originalLabel),
      flowId: E2EFlowIds.webSocketHomeFlow
    )
    await emitter.disconnect()
  }

  @MainActor
  func testWebSocketRowUpdatePreservesUnrelatedRowState() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    guard let inputContainer = findElement(identifier: "textField_e2e.unrelated_input") else {
      XCTFail("Unrelated input row should be visible on the home screen")
      return
    }
    guard let inputField = await tapAndGetEditableField(container: inputContainer) else {
      XCTFail("Failed to get editable unrelated input field")
      return
    }

    let typedText = "keep me \(Int(Date().timeIntervalSince1970))"
    inputField.typeText(typedText)
    XCTAssertTrue(
      (inputField.value as? String)?.contains(typedText) == true,
      "Unrelated input should hold typed text, got: '\(inputField.value as? String ?? "nil")'")

    let updatedLabel = "Updated View \(Int(Date().timeIntervalSince1970))"
    let emitter = WSEmitter()
    do {
      try await emitter.connect(host: apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      try await emitter.updateSDUI(
        flowData: createHomeFlowData(buttonLabel: updatedLabel),
        flowId: E2EFlowIds.webSocketHomeFlow
      )
    } catch {
      XCTFail("Failed to emit update: \(error.localizedDescription)")
      return
    }

    let updatedButton = app.buttons[updatedLabel]
    XCTAssertTrue(
      updatedButton.waitForExistence(timeout: 10),
      "Button should update to '\(updatedLabel)' after notification")
    XCTAssertTrue(
      (inputField.value as? String)?.contains(typedText) == true,
      "Unrelated input should retain typed text after a row-only SDUI update, got: '\(inputField.value as? String ?? "nil")'"
    )

    try? await emitter.updateSDUI(
      flowData: createHomeFlowData(buttonLabel: "View"),
      flowId: E2EFlowIds.webSocketHomeFlow
    )
    await emitter.disconnect()
  }

  @MainActor
  func testConditionalActionEvaluatesLogicalExpression() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    let conditionalLabel = "Conditional \(Int(Date().timeIntervalSince1970))"

    do {
      try await emitter.connect(host: apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      try await emitter.updateSDUI(
        flowData: createConditionalFlowData(buttonLabel: conditionalLabel),
        flowId: E2EFlowIds.webSocketHomeFlow
      )
    } catch {
      XCTFail("Failed to publish conditional flow: \(error.localizedDescription)")
      return
    }

    let conditionalButton = app.buttons[conditionalLabel]
    XCTAssertTrue(
      conditionalButton.waitForExistence(timeout: 10),
      "Conditional button should exist after SDUI update")

    conditionalButton.tap()

    let goHomeButton = app.buttons["Go home"]
    XCTAssertTrue(
      goHomeButton.waitForExistence(timeout: 10),
      "Tapping the conditional button should navigate when the logical expression is true")

    try? await emitter.updateSDUI(
      flowData: createHomeFlowData(buttonLabel: "View"),
      flowId: E2EFlowIds.webSocketHomeFlow
    )
    await emitter.disconnect()
  }

  @MainActor
  func testViewItemFlowLoadsItemFromNavigateQuery() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let (selectedItemId, selectedItemTitle) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Filtered Item"
    )

    let viewButtonLabel = "View filtered \(Int(Date().timeIntervalSince1970))"
    try await emitter.updateSDUI(
      flowData: createHomeFlowData(
        buttonLabel: viewButtonLabel,
        viewItemId: selectedItemId
      ),
      flowId: E2EFlowIds.webSocketHomeFlow
    )
    await emitter.disconnect()

    app.terminate()
    try launchApp()

    let queryButton = app.buttons[viewButtonLabel]
    XCTAssertTrue(
      queryButton.waitForExistence(timeout: 20),
      "Home view button should load with query-aware label after relaunch")

    queryButton.tap()

    let scrollView = app.scrollViews.firstMatch
    XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "View item page should appear")

    XCTAssertTrue(
      app.staticTexts["My item is called"].waitForExistence(timeout: 5),
      "View item page should show the static text row title")
    XCTAssertTrue(
      app.staticTexts[selectedItemTitle].waitForExistence(timeout: 10),
      "View item page should resolve {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} from the item id passed in navigate query"
    )
    XCTAssertTrue(
      app.navigationBars.staticTexts[selectedItemTitle].waitForExistence(timeout: 10),
      "View item page title should resolve {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} from the item id passed in navigate query"
    )
  }

  @MainActor
  func testViewItemPaymentRowsRespectVisiblePredicate() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Payment Item",
      paymentMethods: ["cash": true, "app": false]
    )

    let viewButtonLabel = "View payment \(Int(Date().timeIntervalSince1970))"
    try await emitter.updateSDUI(
      flowData: createHomeFlowData(
        buttonLabel: viewButtonLabel,
        viewItemId: selectedItemId
      ),
      flowId: E2EFlowIds.webSocketHomeFlow
    )
    try await emitter.updateSDUI(
      flowData: Self.viewItemFlowData(
        flowId: E2EFlowIds.webSocketViewFlow,
        pageId: E2EFlowIds.webSocketViewPage
      ),
      flowId: E2EFlowIds.webSocketViewFlow
    )
    await emitter.disconnect()

    app.terminate()
    try launchApp()

    let queryButton = app.buttons[viewButtonLabel]
    XCTAssertTrue(
      queryButton.waitForExistence(timeout: 20),
      "Home view button should load with query-aware label after relaunch")

    queryButton.tap()

    let scrollView = app.scrollViews.firstMatch
    XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "View item page should appear")

    XCTAssertTrue(
      app.staticTexts["Cash accepted"].waitForExistence(timeout: 10),
      "Cash payment row should be visible when \(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.cash is true"
    )
    XCTAssertFalse(
      app.staticTexts["App payments accepted"].waitForExistence(timeout: 2),
      "App payment row should be hidden when \(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.app is false"
    )
  }

  @MainActor
  func testCreateItemFormEditing() async throws {
    let viewItemButton = app.buttons["View"]
    let createItemButton = app.buttons["Create"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    try await emitter.updateSDUI(
      flowData: Self.minimalCreateItemFlowData(),
      flowId: E2EFlowIds.webSocketCreateFlow
    )
    try await Task.sleep(for: .seconds(2))

    createItemButton.tap()

    let scrollView = app.scrollViews.firstMatch
    XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "Page should appear after navigation")

    let titleFieldId = "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
    let priceFieldIds = [
      "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).price}",
      "textField_{buildCurrency(\(MARKETPLACE_ITEMS_RESOURCE_ID).price)}",
    ]
    let priceTokens = ["\(MARKETPLACE_ITEMS_RESOURCE_ID).price", "buildCurrency"]
    let widthFieldId = "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).width}"
    let widthTokens = ["\(MARKETPLACE_ITEMS_RESOURCE_ID).width"]

    // Title field
    guard let titleTextField = findElement(identifier: titleFieldId) else {
      XCTFail("Title text field should exist with identifier '\(titleFieldId)'")
      return
    }
    guard let titleField = await tapAndGetEditableField(container: titleTextField) else {
      XCTFail("Failed to get editable title field")
      return
    }
    let testTitle = "Test Item Title \(Int(Date().timeIntervalSince1970))"
    clearAndType(field: titleField, text: testTitle, placeholder: "Item")
    XCTAssertTrue(
      (titleField.value as? String)?.contains(testTitle) == true,
      "Title field should retain typed text, got: '\(titleField.value as? String ?? "nil")'")
    scrollView.tap()
    try await Task.sleep(for: .milliseconds(500))

    guard
      let priceTextField = findElementWithScroll(
        identifiers: priceFieldIds,
        containsAny: priceTokens,
        in: scrollView
      )
    else {
      XCTFail(
        "Price field should exist (\(priceFieldIds.joined(separator: ", ")), or accessibility containing '\(priceTokens.first ?? "")'))"
      )
      return
    }
    guard let priceField = await tapAndGetEditableField(container: priceTextField) else {
      XCTFail("Failed to get editable price field")
      return
    }
    clearAndType(field: priceField, text: "99", placeholder: "0")
    XCTAssertTrue(
      (priceField.value as? String)?.contains("99") == true,
      "Price field should retain typed value, got: '\(priceField.value as? String ?? "nil")'")
    scrollView.tap()
    try await Task.sleep(for: .milliseconds(500))

    guard
      let widthTextField = findElementWithScroll(
        identifiers: [widthFieldId],
        containsAny: widthTokens,
        in: scrollView
      )
    else {
      XCTFail(
        "Width field should exist (\(widthFieldId), or accessibility containing '\(widthTokens.first ?? "")')"
      )
      return
    }
    guard let widthField = await tapAndGetEditableField(container: widthTextField) else {
      XCTFail("Failed to get editable width field")
      return
    }
    clearAndType(field: widthField, text: "50", placeholder: "0")
    XCTAssertTrue(
      (widthField.value as? String)?.contains("50") == true,
      "Width field should retain typed value, got: '\(widthField.value as? String ?? "nil")'")
    scrollView.tap()
    try await Task.sleep(for: .milliseconds(500))

    let submitButton = app.buttons["Submit"]
    XCTAssertTrue(
      submitButton.waitForExistence(timeout: 5), "Submit should exist on minimal create flow")
    submitButton.tap()

    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 15),
      "Should return to home after create(item)")

    let itemsPayload = try await emitter.getResource(
      service: MARKETPLACE_SERVICE, resource: MARKETPLACE_ITEMS_RESOURCE_ID)
    XCTAssertTrue(
      Self.marketplaceItemsContainListing(
        title: testTitle, priceValue: 99, widthText: "50", items: itemsPayload),
      "Marketplace items should include listing with title, price.value 99, and width 50"
    )

    await emitter.disconnect()
  }

  private static func viewItemNavigateAction(viewItemId: String?) -> String {
    guard let viewItemId else {
      return "{navigate(\(E2EFlowIds.webSocketViewFlow),\(E2EFlowIds.webSocketViewPage))}"
    }
    return
      "{navigate(\(E2EFlowIds.webSocketViewFlow),\(E2EFlowIds.webSocketViewPage),{\(MARKETPLACE_ITEMS_RESOURCE_ID): [\(viewItemId)]})}"
  }

  private static func marketplaceItemsContainListing(
    title: String,
    priceValue: Double,
    widthText: String,
    items: Any
  ) -> Bool {
    guard let itemsArray = responseDataArray(from: items) else { return false }
    let normalizedExpectedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    for case let item as [String: Any] in itemsArray {
      guard let t = item["title"] as? String else { continue }
      let normalizedActualTitle = t.trimmingCharacters(in: .whitespacesAndNewlines)
      guard normalizedActualTitle == normalizedExpectedTitle else { continue }
      var priceOk = false
      if let price = item["price"] as? [String: Any], let pv = price["value"] {
        if let d = pv as? Double, abs(d - priceValue) < 0.01 { priceOk = true }
        if let i = pv as? Int, Double(i) == priceValue { priceOk = true }
        if let n = pv as? NSNumber, abs(n.doubleValue - priceValue) < 0.01 { priceOk = true }
      }
      guard priceOk else { continue }
      let widthValue = item["width"] ?? (item["dimensions"] as? [String: Any])?["width"]
      if let w = widthValue as? String, w == widthText { return true }
      if let w = widthValue as? Int, String(w) == widthText { return true }
      if let n = widthValue as? NSNumber, n.stringValue == widthText { return true }
    }
    return false
  }

  private static func responseDataArray(from response: Any) -> [Any]? {
    if let envelope = response as? [String: Any] {
      return envelope["data"] as? [Any]
    }
    return response as? [Any]
  }

  private func createHomeFlowData(buttonLabel: String, viewItemId: String? = nil) -> [String: Any] {
    let viewAction = Self.viewItemNavigateAction(viewItemId: viewItemId)

    return [
      "id": E2EFlowIds.webSocketHomeFlow,
      "name": "Home",
      "pages": [
        [
          "id": "55e427ac-263c-441f-9673-f60627b1baea",
          "title": "Home",
          "rows": [
            [
              "id": "a74bc80e-ffda-4e19-b8f3-cd882405958b",
              "type": "ColumnContainer",
              "actions": [],
              "visible": "true",
              "title": "",
              "children": [
                Self.inputRow(
                  id: "c72107b6-a50f-4bdb-98d8-4f803e2e8e1b",
                  title: "Notes",
                  source: nil,
                  placeholder: "Type here",
                  destination: "e2e.unrelated_input"
                ),
                Self.buttonRow(
                  id: "441c1433-446b-4682-854d-5d795ef52709",
                  label: buttonLabel,
                  action: viewAction
                ),
                Self.buttonRow(
                  id: "c1ad8812-a824-4ca2-bb27-5bc840ae7e08",
                  label: "Create",
                  action:
                    "{navigate(\(E2EFlowIds.webSocketCreateFlow),\(E2EFlowIds.webSocketCreatePage))}"
                ),
              ],
            ]
          ],
        ]
      ],
    ]
  }

  private func createConditionalFlowData(buttonLabel: String) -> [String: Any] {
    var flowData = createHomeFlowData(buttonLabel: buttonLabel)
    guard var pages = flowData["pages"] as? [[String: Any]],
      var homePage = pages.first,
      var rows = homePage["rows"] as? [[String: Any]],
      var firstRow = rows.first,
      var children = firstRow["children"] as? [[String: Any]],
      var firstButton = children.first,
      var actions = firstButton["actions"] as? [[String: Any]],
      var firstAction = actions.first
    else {
      return flowData
    }

    firstAction["condition"] = "{1 > 0 || (0 > 1 && 2 > 3)}"
    actions[0] = firstAction
    firstButton["actions"] = actions
    children[0] = firstButton
    firstRow["children"] = children
    rows[0] = firstRow
    homePage["rows"] = rows
    pages[0] = homePage
    flowData["pages"] = pages
    return flowData
  }
}

// MARK: - Segment container tab switching

final class E2ESegmentContainerTests: E2ETestBase {
  private static let segmentHomeFlowId = "8f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f"
  private static let segmentPageId = "7e6d5c4b-3a2b-4c1d-8e0f-1a2b3c4d5e6f"

  override var homeFlowId: String? { Self.segmentHomeFlowId }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try seedFlows(
      [
        (
          flowId: Self.segmentHomeFlowId,
          flowData: Self.segmentFlowData(
            flowId: Self.segmentHomeFlowId,
            pageId: Self.segmentPageId
          )
        )
      ]
    )
    try launchApp()
  }

  // Regression guard: switching segments must swap in the selected child's content.
  // A stale `@State` in the shared child position previously kept the first tab's
  // content on screen (e.g. the pickup calendar never updating to delivery).
  func testSwitchingSegmentSwapsChildContent() throws {
    let pickupContent = app.staticTexts["Pickup segment content"]
    let deliveryContent = app.staticTexts["Delivery segment content"]

    XCTAssertTrue(
      pickupContent.waitForExistence(timeout: 20),
      "First segment content should be visible on launch - verify API is running and seeded")
    XCTAssertFalse(
      deliveryContent.exists,
      "Second segment content should be hidden until its tab is selected")

    let deliveryTab = app.segmentedControls.buttons["Delivery"]
    XCTAssertTrue(deliveryTab.waitForExistence(timeout: 5), "Delivery segment should exist")
    deliveryTab.tap()

    XCTAssertTrue(
      deliveryContent.waitForExistence(timeout: 5),
      "Switching to the Delivery tab must swap in the second segment's content")
    XCTAssertFalse(
      pickupContent.exists,
      "First segment content should no longer be visible after switching tabs")
  }

  private static func segmentFlowData(flowId: String, pageId: String) -> [String: Any] {
    return [
      "id": flowId,
      "name": "E2E Segment Container",
      "pages": [
        [
          "id": pageId,
          "title": "Segments",
          "rows": [
            [
              "id": "6a5b4c3d-2e1f-4a0b-8c9d-1e2f3a4b5c6d",
              "type": "SelectSegmentContainer",
              "actions": [],
              "visible": "true",
              "title": "",
              "segments": ["Pickup", "Delivery"],
              "children": [
                Self.textRow(
                  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01",
                  title: "Pickup segment content"
                ),
                Self.textRow(
                  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02",
                  title: "Delivery segment content"
                ),
              ],
            ]
          ],
        ]
      ],
    ]
  }
}

// MARK: - Error / unreachable API

final class E2EErrorStateTests: XCTestCase {
  private var app: XCUIApplication!

  override func setUpWithError() throws {
    try super.setUpWithError()
    continueAfterFailure = false
    app = XCUIApplication()
    app.launchEnvironment["API_HOST"] = "127.0.0.1:59998"
    app.launch()
  }

  override func tearDownWithError() throws {
    app = nil
    try super.tearDownWithError()
  }

  func testUnreachableAPIShowsErrorState() throws {
    let failedMessage = app.staticTexts["Failed to load flows"]
    XCTAssertTrue(
      failedMessage.waitForExistence(timeout: 5),
      "User-visible copy should mention failed flow load"
    )
    let retryMessage = app.staticTexts["Please check your connection and try again"]
    XCTAssertTrue(
      retryMessage.exists,
      "User-visible copy should explain how to recover from a failed flow load"
    )
  }
}
