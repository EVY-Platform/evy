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
  private var bufferedEvents: [[String: Any]] = []

  func connect(host: String) async throws {
    let url = URL(string: "ws://\(host)")!
    ws = URLSession.shared.webSocketTask(with: url)
    ws?.resume()
    bufferedEvents = []
    msgId = 0
    guard let ws else {
      throw NSError(
        domain: "WSEmitter", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "socket not created"])
    }
    try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
      ws.sendPing { error in
        if let error { c.resume(throwing: error) } else { c.resume(returning: ()) }
      }
    }
  }

  func login(token: String, os: String) async throws {
    let response = try await send(method: "rpc.login", params: ["token": token, "os": os])
    guard response["result"] as? Bool == true else {
      throw NSError(
        domain: "WSEmitter", code: 1, userInfo: [NSLocalizedDescriptionKey: "Login failed"])
    }
  }

  func subscribe(event: String) async throws {
    _ = try await send(method: "rpc.on", params: [event])
  }

  func nextDataChanged(resource: String, deadline: Date) async throws -> Bool {
    while true {
      if takeMatchingBufferedDataChanged(resource: resource) {
        return true
      }
      let remaining = deadline.timeIntervalSinceNow
      guard remaining > 0 else { return false }

      let message: URLSessionWebSocketTask.Message? = try await withThrowingTaskGroup(
        of: URLSessionWebSocketTask.Message?.self
      ) { group in
        group.addTask { [ws] in
          guard let ws else { return nil }
          return try await ws.receive()
        }
        group.addTask {
          try await Task.sleep(for: .seconds(remaining))
          return nil
        }
        let first = try await group.next() ?? nil
        group.cancelAll()
        return first ?? nil
      }

      guard let message else { return false }

      guard case .string(let text) = message,
        let data = text.data(using: .utf8),
        let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else {
        continue
      }

      if isMatchingDataChanged(response, resource: resource) {
        return true
      }
      if response["method"] != nil {
        bufferedEvents.append(response)
      }
    }
  }

  private func takeMatchingBufferedDataChanged(resource: String) -> Bool {
    while !bufferedEvents.isEmpty {
      let event = bufferedEvents.removeFirst()
      if isMatchingDataChanged(event, resource: resource) {
        return true
      }
    }
    return false
  }

  private func isMatchingDataChanged(_ event: [String: Any], resource: String) -> Bool {
    guard event["method"] as? String == "dataChanged",
      let params = event["params"] as? [String: Any],
      params["resource"] as? String == resource
    else {
      return false
    }
    return true
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
    let requestId = msgId
    let msg: [String: Any] = [
      "jsonrpc": "2.0", "id": requestId, "method": method, "params": params,
    ]
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
      if let responseId = jsonRpcId(from: response) {
        guard responseId == requestId else { continue }
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
      if response["method"] != nil {
        bufferedEvents.append(response)
      }
    }
  }

  private func jsonRpcId(from response: [String: Any]) -> Int? {
    if let id = response["id"] as? Int { return id }
    if let id = response["id"] as? NSNumber { return id.intValue }
    return nil
  }
}

private enum E2EFlowIds {
  /// The seeded production home flow the app boots into when no HOME_FLOW_ID override is set.
  static let defaultHomeFlow = "f267c629-2594-4770-8cec-d5324ebb4058"
  static let navigationHomeFlow = "10000000-0000-4000-8000-000000000001"
  static let navigationViewFlow = "10000000-0000-4000-8000-000000000007"
  static let navigationViewPage = "10000000-0000-4000-8000-000000000008"
  static let webSocketHomeFlow = "10000000-0000-4000-8000-000000000002"
  static let webSocketHomePage = "55e427ac-263c-441f-9673-f60627b1baea"
  static let webSocketHomeDetailsPage = "10000000-0000-4000-8000-000000000009"
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
          "footer": [
            "id": "1cb41189-6fa5-4562-996a-7cefb88a08ca",
            "type": "Button",
            "visible": "true",
            "title": "",
            "label": "Submit",
            "actions": [
              [
                "condition": "",
                "false": "",
                "true": "{show()}",
              ]
            ],
            "child": Self.submitListingSheetChild(
              createAction:
                "{create(\(MARKETPLACE_SERVICE),\(MARKETPLACE_ITEMS_RESOURCE_ID))}"
            ),
          ] as [String: Any],
        ]
      ],
    ]
  }

  /// Runs async work (websocket emitter calls) from a synchronous test method. Keeping UI
  /// tests synchronous avoids an Xcode 26 Swift-concurrency runtime crash
  /// (swiftlang/swift#84793: "freed pointer was not the last allocation") that aborts the
  /// test runner when an async test body interleaves awaits with run-loop-pumping XCUI waits.
  private final class AsyncResultBox<U>: @unchecked Sendable {
    var result: Result<U, Error>?
  }

  func awaitResult<T>(
    _ label: String,
    timeout: TimeInterval = 30,
    _ body: @escaping () async throws -> T
  ) throws -> T {
    let box = AsyncResultBox<T>()
    let done = expectation(description: label)
    Task.detached {
      do {
        box.result = .success(try await body())
      } catch {
        box.result = .failure(error)
      }
      done.fulfill()
    }
    wait(for: [done], timeout: timeout)
    guard let result = box.result else {
      throw NSError(
        domain: "E2ETest", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "\(label) timed out after \(timeout)s"])
    }
    return try result.get()
  }

  /// Returns the hittable button with the given label, waiting for one to appear.
  /// Used when a sheet's confirm button shares its label with an obscured button behind
  /// the sheet (`isHittable` is not a legal key path inside XCUI query predicates).
  @MainActor
  func waitForHittableButton(labeled label: String, timeout: TimeInterval = 5) -> XCUIElement? {
    let deadline = Date().addingTimeInterval(timeout)
    let query = app.buttons.matching(NSPredicate(format: "label == %@", label))
    repeat {
      for index in 0..<query.count {
        let element = query.element(boundBy: index)
        if element.exists && element.isHittable {
          return element
        }
      }
      _ = query.firstMatch.waitForExistence(timeout: 0.5)
    } while Date() < deadline
    return nil
  }

  /// The page's content scroll view (accessibility id `page_<pageId>` from EVYPage).
  /// IMPORTANT: never use `app.scrollViews.firstMatch` while the keyboard is up — it
  /// resolves to the keyboard's QuickType suggestion bar (a 44pt scroll view), so taps
  /// and swipes aimed at "the page" hit the keyboard instead.
  @MainActor
  var pageScrollView: XCUIElement {
    app.scrollViews.matching(NSPredicate(format: "identifier BEGINSWITH 'page_'")).firstMatch
  }

  /// Dismisses the software keyboard by tapping a non-interactive static label inside the
  /// page scroll view: the page's tap gesture resigns the first responder, and a label
  /// (unlike a blind coordinate) can never re-focus an input. Then waits for the keyboard
  /// to actually retract so the next tap isn't swallowed mid-transition.
  @MainActor
  func dismissKeyboard() {
    let keyboard = app.keyboards.firstMatch
    guard keyboard.exists else { return }
    let label = pageScrollView.staticTexts.firstMatch
    if label.exists {
      label.tap()
    } else {
      pageScrollView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.02)).tap()
    }
    _ = keyboard.waitForNonExistence(timeout: 3)
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

  /// Synchronous on purpose: UI-driving helpers should not suspend. Mixing `Task.sleep`
  /// with run-loop-pumping XCUI waits triggers a Swift-concurrency runtime crash in the
  /// Xcode 26 toolchain (swiftlang/swift#84793: "freed pointer was not the last allocation").
  @MainActor func tapAndGetEditableField(container: XCUIElement) -> XCUIElement? {
    container.tap()
    let textField = container.textFields.firstMatch
    if textField.waitForExistence(timeout: 2) {
      return textField
    }
    let anyTextField = app.textFields.firstMatch
    if anyTextField.waitForExistence(timeout: 2) {
      return anyTextField
    }
    return nil
  }

  @MainActor
  private func confirmationSheetIsPresent() -> Bool {
    app.navigationBars.staticTexts["Confirmation"].exists
      || app.staticTexts["Confirmation"].exists
  }

  @MainActor
  func waitForConfirmationSheet(timeout: TimeInterval = 5) -> Bool {
    if app.navigationBars.staticTexts["Confirmation"].waitForExistence(timeout: timeout) {
      return true
    }
    return app.staticTexts["Confirmation"].waitForExistence(timeout: 1)
  }

  @MainActor
  func waitForConfirmationSheetDismissed(timeout: TimeInterval = 5) -> Bool {
    let navigationTitle = app.navigationBars.staticTexts["Confirmation"]
    if navigationTitle.exists {
      return navigationTitle.waitForNonExistence(timeout: timeout)
    }
    let staticTitle = app.staticTexts["Confirmation"]
    if staticTitle.exists {
      return staticTitle.waitForNonExistence(timeout: timeout)
    }
    return true
  }

  @MainActor
  func dismissConfirmationSheet() {
    // Swipe gestures are unreliable for dismissing detented sheets in XCUITest (the swipe
    // is often captured by the sheet's inner ScrollView). The sheet opens at the .medium
    // detent, which dims the presenting view above it — a single tap on that backdrop is
    // the standard, deterministic way to dismiss.
    for _ in 0..<2 {
      guard confirmationSheetIsPresent() else { return }
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1)).tap()
      if waitForConfirmationSheetDismissed(timeout: 3) { return }
    }
  }

  /// Taps the "Request …" confirm button inside an open pickup/delivery confirmation sheet.
  @MainActor
  func tapConfirmationSheetRequestButton(
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let button = app.buttons.containing(
      NSPredicate(format: "label BEGINSWITH %@", "Request ")
    ).firstMatch
    XCTAssertTrue(
      button.waitForExistence(timeout: 5), "Request button should be visible", file: file,
      line: line)
    button.tap()
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
    try awaitResult(description, timeout: timeout, operation)
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
              "type": "ListContainer",
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
    visible: String = "true",
    name: String = ""
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
    if !name.isEmpty {
      row["name"] = name
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
    action: String? = nil,
    condition: String = "",
    falseAction: String = "",
    visible: String = "true",
    style: String? = nil,
    child: [String: Any]? = nil
  ) -> [String: Any] {
    let resolvedActions: [[String: String]]
    if let action {
      resolvedActions = [
        rowAction(
          true: action,
          condition: condition,
          false: falseAction
        )
      ]
    } else {
      resolvedActions = []
    }
    var row: [String: Any] = [
      "id": id,
      "type": "Button",
      "visible": visible,
      "title": "",
      "label": label,
      "actions": resolvedActions,
    ]
    if let style {
      row["style"] = style
    }
    if let child {
      row["child"] = child
    }
    return row
  }

  static func headingRow(
    id: String,
    title: String
  ) -> [String: Any] {
    return [
      "id": id,
      "type": "Heading",
      "actions": [],
      "visible": "true",
      "title": title,
      "label": "",
    ]
  }

  static func rowAction(
    true action: String,
    condition: String = "",
    false falseAction: String = ""
  ) -> [String: String] {
    [
      "condition": condition,
      "false": falseAction,
      "true": action,
    ]
  }

  static func cancelRequestVisibilityExpressions() -> (hasActive: String, noActive: String) {
    let requestsResourceId = MarketplaceResource.requests.rawValue
    let activeMatch =
      "{findFirst(\(requestsResourceId), \(MARKETPLACE_ITEMS_RESOURCE_ID).id, item_id, false, archived).item_id"
    let hasActive = "\(activeMatch) == \(MARKETPLACE_ITEMS_RESOURCE_ID).id}"
    let noActive = "\(activeMatch) != \(MARKETPLACE_ITEMS_RESOURCE_ID).id}"
    return (hasActive, noActive)
  }

  static func viewItemCancelRequestFlowData(flowId: String, pageId: String) -> [String: Any] {
    let requestsResourceId = MarketplaceResource.requests.rawValue
    let visibility = cancelRequestVisibilityExpressions()
    let pickupCreateAction =
      "{create(\(MARKETPLACE_SERVICE),\(requestsResourceId),{type: pickup, item_id: \(MARKETPLACE_ITEMS_RESOURCE_ID).id, time: selected_pickup_timeslot, archived: false})}"
    let deliveryCreateAction =
      "{create(\(MARKETPLACE_SERVICE),\(requestsResourceId),{type: delivery, item_id: \(MARKETPLACE_ITEMS_RESOURCE_ID).id, time: selected_delivery_timeslot, archived: false})}"
    let shippingCreateAction =
      "{create(\(MARKETPLACE_SERVICE),\(requestsResourceId),{type: shipping, item_id: \(MARKETPLACE_ITEMS_RESOURCE_ID).id, postalcode: shipping_address.postcode, archived: false})}"
    let cancelAction =
      "{update(\(MARKETPLACE_SERVICE),\(requestsResourceId),{item_id: \(MARKETPLACE_ITEMS_RESOURCE_ID).id, archived: false},{archived: true})}"

    return [
      "id": flowId,
      "name": "E2E Cancel Request",
      "pages": [
        [
          "id": pageId,
          "title": "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}",
          "rows": [
            [
              "id": "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
              "type": "SelectSegmentContainer",
              "actions": [],
              "visible": "true",
              "title": "",
              "segments": ["Pickup", "Delivery", "Shipping"],
              "children": [
                [
                  "id": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
                  "type": "ListContainer",
                  "actions": [],
                  "visible": "true",
                  "title": "",
                  "children": [
                    Self.timeslotPickerRow(
                      id: "b3c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e",
                      source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).pickup_selection}",
                      actions: [
                        Self.rowAction(true: "{show()}")
                      ],
                      visible: visibility.noActive,
                      name: "Pickup request times",
                      child: Self.pickupConfirmationSheetChild(
                        pickupCreateAction: pickupCreateAction
                      )
                    ),
                    Self.buttonRow(
                      id: "c4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f",
                      label: "Cancel request",
                      action: "{show()}",
                      visible: visibility.hasActive,
                      style: "danger",
                      child: Self.cancelRequestSheetChild(
                        cancelAction: cancelAction,
                        message:
                          "Cancel pickup request for the \"{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}\"?"
                      )
                    ),
                  ],
                ],
                [
                  "id": "d5e6f7a8-b9c0-4d1e-2f3a-4b5c6d7e8f9a",
                  "type": "ListContainer",
                  "actions": [],
                  "visible": "true",
                  "title": "",
                  "children": [
                    Self.timeslotPickerRow(
                      id: "e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b",
                      source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).delivery_selection}",
                      destination: "{selected_delivery_timeslot}",
                      actions: [
                        Self.rowAction(true: "{show()}")
                      ],
                      visible: visibility.noActive,
                      name: "Delivery request times",
                      child: Self.deliveryConfirmationSheetChild(
                        deliveryCreateAction: deliveryCreateAction
                      )
                    ),
                    Self.buttonRow(
                      id: "f7a8b9c0-d1e2-4f3a-4b5c-6d7e8f9a0b1c",
                      label: "Cancel request",
                      action: "{show()}",
                      visible: visibility.hasActive,
                      style: "danger",
                      child: Self.cancelRequestSheetChild(
                        cancelAction: cancelAction,
                        message:
                          "Cancel delivery request for the \"{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}\"?"
                      )
                    ),
                  ],
                ],
                [
                  "id": "a8b9c0d1-e2f3-4a4b-5c6d-7e8f9a0b1c2d",
                  "type": "ListContainer",
                  "actions": [],
                  "visible": "true",
                  "title": "",
                  "children": [
                    Self.inputRow(
                      id: "b9c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e",
                      title: "Shipping postcode",
                      source: nil,
                      placeholder: "Postcode",
                      destination: "{shipping_address.postcode}",
                      visible: visibility.noActive
                    ),
                    Self.buttonRow(
                      id: "c0d1e2f3-a4b5-4c6d-7e8f-9a0b1c2d3e4f",
                      label: "Ask to buy",
                      action: "{show()}",
                      condition: "{length(shipping_address.postcode) > 0}",
                      falseAction: "{highlight_required(postcode)}",
                      visible: visibility.noActive,
                      child: Self.shippingConfirmationSheetChild(
                        shippingCreateAction: shippingCreateAction
                      )
                    ),
                    Self.buttonRow(
                      id: "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a",
                      label: "Cancel request",
                      action: "{show()}",
                      visible: visibility.hasActive,
                      style: "danger",
                      child: Self.cancelRequestSheetChild(
                        cancelAction: cancelAction,
                        message:
                          "Cancel shipping request for the \"{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}\"?"
                      )
                    ),
                  ],
                ],
              ],
            ]
          ],
        ]
      ],
    ]
  }

  static func timeslotPickerRow(
    id: String,
    source: String,
    destination: String = "{selected_pickup_timeslot}",
    actions: [[String: String]] = [],
    visible: String = "true",
    name: String = "Pickup available times",
    child: [String: Any]? = nil
  ) -> [String: Any] {
    var row: [String: Any] = [
      "id": id,
      "type": "TimeslotPicker",
      "source": source,
      "destination": destination,
      "actions": actions,
      "visible": visible,
      "title": "",
      "start_time": "07:00",
      "end_time": "19:00",
      "timeslot_interval_minutes": "30",
      "label_interval_minutes": "60",
      "header_format": "{formatDatetime($datum, \"EEE\")}",
      "header_subtitle": "{formatDatetime($datum, \"MMM do\")}",
      "timeslot_format": "{formatDatetime($datum, \"HH:mm\")}",
      "name": name,
    ]
    if let child {
      row["child"] = child
    }
    return row
  }

  /// A confirm button whose action chain runs `action` then `{close()}`.
  static func confirmSheetButton(
    id: String,
    label: String,
    action: String,
    name: String,
    style: String? = nil
  ) -> [String: Any] {
    var button = Self.buttonRow(
      id: id,
      label: label,
      action: action,
      style: style
    )
    button["actions"] = [
      Self.rowAction(true: action),
      Self.rowAction(true: "{close()}"),
    ]
    button["name"] = name
    return button
  }

  static func confirmationSheetChild(
    id: String,
    name: String,
    messageRows: [[String: Any]],
    confirmButton: [String: Any]
  ) -> [String: Any] {
    [
      "id": id,
      "type": "ListContainer",
      "actions": [],
      "visible": "true",
      "title": "Confirmation",
      "children": messageRows + [confirmButton],
      "name": name,
    ]
  }

  static func pickupConfirmationSheetChild(pickupCreateAction: String) -> [String: Any] {
    Self.confirmationSheetChild(
      id: "b8c7d6e5-f4a3-4b2c-9d1e-0f8a7b6c5d4e",
      name: "Pickup confirmation sheet",
      messageRows: [
        Self.textRow(
          id: "c9d8e7f6-a5b4-4c3d-8e2f-1a9b8c7d6e5f",
          title: "",
          subtitle:
            "You are about to request to pickup {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} at {formatDatetime(selected_pickup_timeslot, \"EEE do\")} {formatDatetime(selected_pickup_timeslot, \"HH:mm\")}",
          name: "Pickup confirmation message"
        ),
        Self.textRow(
          id: "d0e9f8a7-b6c5-4d4e-9f3a-2b0c9d8e7f6a",
          title: "",
          subtitle:
            "Be advised someone may request to pickup {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} earlier than your selected timeslot.",
          visible:
            "{selected_pickup_timeslot != earliestDatetime(\(MARKETPLACE_ITEMS_RESOURCE_ID).pickup_selection)}",
          name: "Pickup earlier timeslot warning"
        ),
      ],
      confirmButton: Self.confirmSheetButton(
        id: "e1f0a9b8-c7d6-4e5f-a04b-3c1d0e9f8a7b",
        label: "Request {formatDatetime(selected_pickup_timeslot, \"HH:mm\")}",
        action: pickupCreateAction,
        name: "Confirm pickup request"
      )
    )
  }

  static func shippingConfirmationSheetChild(shippingCreateAction: String) -> [String: Any] {
    Self.confirmationSheetChild(
      id: "f2a1b0c9-d8e7-4f6a-5b4c-3d2e1f0a9b8c",
      name: "Shipping confirmation sheet",
      messageRows: [
        Self.textRow(
          id: "a3b2c1d0-e9f8-4a7b-6c5d-4e3f2a1b0c9d",
          title: "",
          subtitle:
            "You are about to request shipping {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} to you",
          name: "Shipping confirmation message"
        ),
        Self.textRow(
          id: "b4c3d2e1-f0a9-4b8c-7d6e-5f4a3b2c1d0e",
          title: "",
          subtitle:
            "Your payment will be held on EVY until shipping has been confirmed (within 48 hours). If the seller does not ship in time, you will be refunded the fee and the request will be cancelled.",
          visible: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).shipping_fee > 0}",
          name: "Shipping surcharge held payment notice"
        ),
        Self.textRow(
          id: "c5d4e3f2-a1b0-4c9d-8e7f-6a5b4c3d2e1f",
          title: "",
          subtitle:
            "Shipping should be confirmed within 48 hours by the seller. If not, the request will be cancelled.",
          visible: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).shipping_fee <= 0}",
          name: "Shipping no surcharge notice"
        ),
      ],
      confirmButton: Self.confirmSheetButton(
        id: "d6e5f4a3-b2c1-4d0e-9f8a-7b6c5d4e3f2a",
        label: "Request shipping",
        action: shippingCreateAction,
        name: "Confirm shipping request"
      )
    )
  }

  static func deliveryConfirmationSheetChild(deliveryCreateAction: String) -> [String: Any] {
    Self.confirmationSheetChild(
      id: "c4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e80",
      name: "Delivery confirmation sheet",
      messageRows: [
        Self.textRow(
          id: "d5e6f7a8-b9c0-4d1e-2f3a-4b5c6d7e8f9b",
          title: "",
          subtitle:
            "Request to deliver \"{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}\" at {formatDatetime(selected_delivery_timeslot, \"EEE do\")} {formatDatetime(selected_delivery_timeslot, \"HH:mm\")}",
          name: "Delivery confirmation message"
        )
      ],
      confirmButton: Self.confirmSheetButton(
        id: "e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0c",
        label: "Request {formatDatetime(selected_delivery_timeslot, \"HH:mm\")}",
        action: deliveryCreateAction,
        name: "Confirm delivery request"
      )
    )
  }

  static func cancelRequestSheetChild(
    cancelAction: String,
    message: String
  ) -> [String: Any] {
    Self.confirmationSheetChild(
      id: "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5d",
      name: "Cancel request confirmation sheet",
      messageRows: [
        Self.textRow(
          id: "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6e",
          title: "",
          subtitle: message,
          name: "Cancel request confirmation message"
        )
      ],
      confirmButton: Self.confirmSheetButton(
        id: "f3a4b5c6-d7e8-4f9a-0b1c-2d3e4f5a6b7d",
        label: "Cancel request",
        action: cancelAction,
        name: "Confirm cancel request",
        style: "danger"
      )
    )
  }

  static func submitListingSheetChild(createAction: String) -> [String: Any] {
    // Mirrors the production fixture's "Confirm submit listing" button: create → close the
    // sheet → navigate back to the home flow (a sheet-level {close()} only dismisses the
    // sheet, so returning home needs the explicit navigate).
    var confirmButton = Self.confirmSheetButton(
      id: "c6d7e8f9-a0b1-4c2d-3e4f-5a6b7c8d9e0f",
      label: "Submit",
      action: createAction,
      name: "Confirm submit listing"
    )
    var confirmActions = (confirmButton["actions"] as? [[String: String]]) ?? []
    confirmActions.append(
      Self.rowAction(
        true: "{navigate(\(E2EFlowIds.defaultHomeFlow),\(E2EFlowIds.webSocketHomePage))}"))
    confirmButton["actions"] = confirmActions

    return Self.confirmationSheetChild(
      id: "a4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d",
      name: "Submit listing confirmation sheet",
      messageRows: [
        Self.textRow(
          id: "b5c6d7e8-f9a0-4b1c-2d3e-4f5a6b7c8d9e",
          title: "",
          subtitle: "Are you sure?",
          name: "Submit listing confirmation message"
        )
      ],
      confirmButton: confirmButton
    )
  }

  static func viewItemTimeslotFlowData(flowId: String, pageId: String) -> [String: Any] {
    let source = "{\(MARKETPLACE_ITEMS_RESOURCE_ID).pickup_selection}"
    return [
      "id": flowId,
      "name": "E2E View Item Timeslot",
      "pages": [
        [
          "id": pageId,
          "title": "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}",
          "rows": [
            Self.timeslotPickerRow(
              id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e",
              source: source,
              name: "Direct timeslot picker"
            ),
            [
              "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6f",
              "type": "SelectSegmentContainer",
              "actions": [],
              "visible": "true",
              "title": "",
              "segments": ["Pickup"],
              "children": [
                [
                  "id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                  "type": "ListContainer",
                  "actions": [],
                  "visible": "true",
                  "title": "",
                  "children": [
                    Self.timeslotPickerRow(
                      id: "d4e5f6a7-b8c9-4012-d345-6789abcdef02",
                      source: source,
                      name: "Nested timeslot picker"
                    )
                  ],
                  "name": "Nested pickup list",
                ]
              ],
              "name": "Nested segment container",
            ],
          ],
        ]
      ],
    ]
  }

  static func viewItemRequestFlowData(flowId: String, pageId: String) -> [String: Any] {
    let requestsResourceId = MarketplaceResource.requests.rawValue
    let pickupCreateAction =
      "{create(\(MARKETPLACE_SERVICE),\(requestsResourceId),{type: pickup, item_id: \(MARKETPLACE_ITEMS_RESOURCE_ID).id, time: selected_pickup_timeslot, archived: false})}"
    let shippingCreateAction =
      "{create(\(MARKETPLACE_SERVICE),\(requestsResourceId),{type: shipping, item_id: \(MARKETPLACE_ITEMS_RESOURCE_ID).id, postalcode: shipping_address.postcode, archived: false})}"

    return [
      "id": flowId,
      "name": "E2E Marketplace Requests",
      "pages": [
        [
          "id": pageId,
          "title": "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}",
          "rows": [
            Self.timeslotPickerRow(
              id: "9405eec8-4729-4ce0-b3e0-5c7f5a611001",
              source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).pickup_selection}",
              actions: [
                Self.rowAction(true: "{show()}")
              ],
              name: "Pickup request times",
              child: Self.pickupConfirmationSheetChild(pickupCreateAction: pickupCreateAction)
            ),
            Self.inputRow(
              id: "9405eec8-4729-4ce0-b3e0-5c7f5a611002",
              title: "Shipping postcode",
              source: nil,
              placeholder: "Postcode",
              destination: "{shipping_address.postcode}"
            ),
            Self.buttonRow(
              id: "9405eec8-4729-4ce0-b3e0-5c7f5a611003",
              label: "Ask to buy",
              action: "{show()}",
              condition: "{length(shipping_address.postcode) > 0}",
              falseAction: "{highlight_required(postcode)}",
              child: Self.shippingConfirmationSheetChild(
                shippingCreateAction: shippingCreateAction
              )
            ),
          ],
        ]
      ],
    ]
  }

  static func sheetTitleReactivityFlowData(flowId: String, pageId: String) -> [String: Any] {
    [
      "id": flowId,
      "name": "E2E Sheet Title Reactivity",
      "pages": [
        [
          "id": pageId,
          "title": "Sheet title test",
          "rows": [
            Self.buttonRow(
              id: "f8e7d6c5-b4a3-4f2e-9d1c-0b9a8f7e6d5c",
              label: "Open sheet",
              action: "{show()}",
              child: [
                "id": "a9f8e7d6-c5b4-4a3f-2e1d-0c9b8a7f6e5d",
                "type": "ListContainer",
                "actions": [],
                "visible": "true",
                "title": "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}",
                "children": [
                  Self.inputRow(
                    id: "b0a9f8e7-d6c5-4b4a-3f2e-1d0c9b8a7f6e",
                    title: "Edit title",
                    source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}",
                    placeholder: "Enter a title",
                    destination: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
                  )
                ],
                "name": "Sheet title reactivity sheet",
              ]
            )
          ],
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
            Self.inputRow(
              id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
              title: "Edit title",
              source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}",
              placeholder: "Enter a title",
              destination: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
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
    paymentMethods: [String: Bool]? = nil,
    pickupSelection: [String]? = nil,
    shippingFee: String? = nil
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
    if let pickupSelection {
      data["pickup_selection"] = pickupSelection
    }
    if let shippingFee {
      data["shipping_fee"] = shippingFee
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
  func testEphemeralPersistsAcrossPagesButResetsOnFlowChange() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let typedText = "reset me \(Int(Date().timeIntervalSince1970))"
    try await typeIntoHomeEphemeralField(typedText)
    XCTAssertTrue(sharedHomeText(typedText).waitForExistence(timeout: 5))

    app.buttons["Details"].tap()
    XCTAssertTrue(app.staticTexts["Details page"].waitForExistence(timeout: 5))
    let backButton = app.navigationBars.buttons.firstMatch
    XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
    backButton.tap()
    XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")
    XCTAssertTrue(
      sharedHomeText(typedText).waitForExistence(timeout: 5),
      "Same-flow page navigation should not clear ephemeral page data")

    app.buttons["Create"].tap()
    XCTAssertFalse(viewItemButton.exists, "Home buttons should not be visible after flow change")
    XCTAssertTrue(
      backButton.waitForExistence(timeout: 5), "Back button should exist after flow change")
    backButton.tap()
    XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")
    XCTAssertFalse(
      sharedHomeText(typedText).waitForExistence(timeout: 2),
      "Leaving and re-entering the flow should clear ephemeral page data")
  }

  @MainActor
  func testRowsAddedToBackgroundedPageShareEphemeralValueOnReturn() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let typedText = "bg share \(Int(Date().timeIntervalSince1970))"
    try await typeIntoHomeEphemeralField(typedText)
    XCTAssertTrue(sharedHomeText(typedText).waitForExistence(timeout: 5))

    // Navigate away so the home page is no longer the active scope.
    app.buttons["Details"].tap()
    XCTAssertTrue(app.staticTexts["Details page"].waitForExistence(timeout: 5))

    await publishHomeFlow(
      createHomeFlowData(buttonLabel: "View", includeAddedSharedRow: true))

    let backButton = app.navigationBars.buttons.firstMatch
    XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
    backButton.tap()
    XCTAssertTrue(viewItemButton.waitForExistence(timeout: 5), "Should return to home screen")

    XCTAssertTrue(
      addedHomeText(typedText).waitForExistence(timeout: 10),
      "A row added while the page was backgrounded must share the existing ephemeral value on return"
    )

    await publishHomeFlow(createHomeFlowData(buttonLabel: "View"))
  }

  @MainActor
  func testRowsAddedWhileDisplayedShareExistingEphemeralValue() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let typedText = "added share \(Int(Date().timeIntervalSince1970))"
    try await typeIntoHomeEphemeralField(typedText)
    XCTAssertTrue(
      sharedHomeText(typedText).waitForExistence(timeout: 5),
      "Existing text row should reflect the typed ephemeral value")

    await publishHomeFlow(
      createHomeFlowData(buttonLabel: "View", includeAddedSharedRow: true))

    XCTAssertTrue(
      addedHomeText(typedText).waitForExistence(timeout: 10),
      "A row added via WebSocket while the page is displayed must share the existing ephemeral value, not reset it"
    )

    await publishHomeFlow(createHomeFlowData(buttonLabel: "View"))
  }

  @MainActor
  func testHeadingRowUpdatesInRealtimeWhenInputEdits() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    await publishHomeFlow(createHomeFlowData(buttonLabel: "View", includeHeadingRow: true))

    let typedText = "heading live \(Int(Date().timeIntervalSince1970))"
    try await typeIntoHomeEphemeralField(typedText)
    XCTAssertTrue(
      sharedHomeText(typedText).waitForExistence(timeout: 5),
      "Existing text row should reflect the typed ephemeral value")
    XCTAssertTrue(
      headingHomeText(typedText).waitForExistence(timeout: 5),
      "Heading row bound to the same value as the input must update in realtime, like the Text row does"
    )

    await publishHomeFlow(createHomeFlowData(buttonLabel: "View"))
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
    guard let inputField = tapAndGetEditableField(container: inputContainer) else {
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

    let titleInputId = "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
    guard let titleInput = findElement(identifier: titleInputId) else {
      XCTFail("View item page should show an input bound to the item title")
      return
    }
    guard let titleField = tapAndGetEditableField(container: titleInput) else {
      XCTFail("Failed to get editable title input on the view item page")
      return
    }
    XCTAssertEqual(
      titleField.value as? String,
      selectedItemTitle,
      "Input bound to {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} must show the existing item data, not an empty bootstrapped draft"
    )

    let editedTitle = "Edited \(Int(Date().timeIntervalSince1970))"
    clearAndType(field: titleField, text: editedTitle, placeholder: "Enter a title")
    XCTAssertTrue(
      app.navigationBars.staticTexts[editedTitle].waitForExistence(timeout: 10),
      "Page nav title should update when {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} is edited"
    )
  }

  @MainActor
  func testSheetTitleUpdatesWhenWatchedDataChanges() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let (selectedItemId, selectedItemTitle) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Sheet Title Item"
    )

    let viewLabel = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "View sheet title",
      itemId: selectedItemId,
      viewFlowDataBuilder: Self.sheetTitleReactivityFlowData
    )
    _ = viewLabel

    let openSheetButton = app.buttons["Open sheet"]
    XCTAssertTrue(
      openSheetButton.waitForExistence(timeout: 10),
      "Sheet title test page should show the Open sheet button")
    openSheetButton.tap()

    XCTAssertTrue(
      app.navigationBars.staticTexts[selectedItemTitle].waitForExistence(timeout: 10),
      "Sheet nav title should resolve {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} on open"
    )

    let titleInputId = "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
    guard let titleInput = findElement(identifier: titleInputId) else {
      XCTFail("Sheet should show an input bound to the item title")
      return
    }
    guard let titleField = tapAndGetEditableField(container: titleInput) else {
      XCTFail("Failed to get editable title input inside the sheet")
      return
    }

    let editedTitle = "Sheet Edited \(Int(Date().timeIntervalSince1970))"
    clearAndType(field: titleField, text: editedTitle, placeholder: "Enter a title")
    XCTAssertTrue(
      app.navigationBars.staticTexts[editedTitle].waitForExistence(timeout: 10),
      "Sheet nav title should update when {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} is edited without dismissing the sheet"
    )
  }

  @MainActor
  func testViewItemTimeslotPickerRendersPickupAvailability() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Timeslot Item",
      pickupSelection: ["2026-06-03T09:00:00"]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "View timeslot",
      itemId: selectedItemId,
      viewFlowDataBuilder: Self.viewItemTimeslotFlowData,
      buttonExistenceMessage: "Timeslot view button should appear after relaunch"
    )

    let scrollView = app.scrollViews.firstMatch
    XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "View item page should appear")

    let directTimeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(
      directTimeslot.waitForExistence(timeout: 10),
      "Direct TimeslotPicker should render the 09:00 slot from pickup_selection")
    XCTAssertTrue(
      directTimeslot.isHittable,
      "Direct TimeslotPicker slot should be hittable, not collapsed to zero height")

    scrollView.swipeUp()

    let allTimeslotLabels = app.staticTexts.matching(
      NSPredicate(format: "label == %@", "09:00"))
    XCTAssertGreaterThanOrEqual(
      allTimeslotLabels.count, 2,
      "Both direct and nested-in-segment TimeslotPickers must render the available time")
    XCTAssertTrue(
      allTimeslotLabels.element(boundBy: 1).isHittable,
      "Nested TimeslotPicker slot should be hittable inside segment nesting")
  }

  @MainActor
  func testTimeslotPickerCreatesPickupRequest() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, selectedItemTitle) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Pickup request item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Request pickup",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "dataChanged")

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    timeslot.tap()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    XCTAssertTrue(
      app.staticTexts.containing(
        NSPredicate(format: "label CONTAINS %@", selectedItemTitle)
      ).firstMatch.waitForExistence(timeout: 5),
      "Confirmation sheet should mention the item title")

    tapConfirmationSheetRequestButton()
    XCTAssertFalse(
      app.alerts.firstMatch.waitForExistence(timeout: 2),
      "Pickup request should not show a native confirmation alert")

    let pickupRequestCreated = try await waitForMarketplaceRequest(
      emitter: emitter,
      type: "pickup",
      itemId: selectedItemId,
      valueKey: "time",
      value: selectedTimeslot
    )
    XCTAssertTrue(
      pickupRequestCreated,
      "Tapping a pickup timeslot should create a matching marketplace request"
    )
    await emitter.disconnect()
  }

  @MainActor
  func testTimeslotConfirmationCancelDoesNotCreateRequest() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Cancel pickup item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Cancel pickup",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    timeslot.tap()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    dismissConfirmationSheet()

    let requestsAfterCancel = try await emitter.getResource(
      service: MARKETPLACE_SERVICE,
      resource: MarketplaceResource.requests.rawValue
    )
    XCTAssertFalse(
      Self.marketplaceRequestsContain(
        requestsAfterCancel,
        type: "pickup",
        itemId: selectedItemId
      ),
      "Cancelling confirmation should not create a pickup request"
    )
    XCTAssertTrue(timeslot.exists, "Pickup timeslot should remain visible after cancel")
    XCTAssertFalse(
      app.buttons["Cancel request"].exists,
      "Cancel request should not appear when no request was created"
    )
    await emitter.disconnect()
  }

  @MainActor
  func testPickupConfirmationSheetShowsEarlierTimeslotWarning() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Later pickup item",
      pickupSelection: ["2026-06-03T09:00:00", "2026-06-03T10:00:00"]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Later pickup",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )

    let laterTimeslot = app.staticTexts["10:00"].firstMatch
    XCTAssertTrue(
      laterTimeslot.waitForExistence(timeout: 10), "Later pickup timeslot should be visible")
    laterTimeslot.tap()

    let earlierTimeslotWarning = app.staticTexts.containing(
      NSPredicate(format: "label CONTAINS %@", "earlier than your selected timeslot")
    ).firstMatch
    XCTAssertTrue(
      earlierTimeslotWarning.waitForExistence(timeout: 5),
      "Later timeslot confirmation should show the earlier-timeslot warning")

    dismissConfirmationSheet()
    XCTAssertTrue(
      waitForConfirmationSheetDismissed(timeout: 5),
      "Confirmation sheet should dismiss")

    let earlierTimeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(
      earlierTimeslot.waitForExistence(timeout: 10), "Earlier pickup timeslot should be visible")
    earlierTimeslot.tap()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Confirmation sheet should reopen for the earlier timeslot")
    XCTAssertFalse(
      earlierTimeslotWarning.waitForExistence(timeout: 2),
      "Earliest timeslot confirmation should not show the earlier-timeslot warning")
    await emitter.disconnect()
  }

  @MainActor
  func testCancelRequestTogglesPickerAndShippingButton() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Cancel request item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Cancel request",
      itemId: selectedItemId,
      viewFlowDataBuilder: Self.viewItemCancelRequestFlowData,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "dataChanged")

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    XCTAssertFalse(
      app.buttons["Cancel request"].exists,
      "Cancel request should be hidden before a request exists")

    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    tapConfirmationSheetRequestButton()

    let pickupRequestCreated = try await waitForMarketplaceRequest(
      emitter: emitter,
      type: "pickup",
      itemId: selectedItemId,
      valueKey: "time",
      value: selectedTimeslot
    )
    XCTAssertTrue(pickupRequestCreated, "Tapping a pickup timeslot should create a request")

    let cancelButton = app.buttons["Cancel request"].firstMatch
    XCTAssertTrue(
      cancelButton.waitForExistence(timeout: 10),
      "Cancel request should replace the pickup timeslot")
    XCTAssertFalse(timeslot.exists, "Pickup timeslot should be hidden after creating a request")

    let shippingTab = app.segmentedControls.buttons["Shipping"]
    XCTAssertTrue(shippingTab.waitForExistence(timeout: 5), "Shipping segment should exist")
    shippingTab.tap()
    XCTAssertTrue(
      app.buttons["Cancel request"].firstMatch.waitForExistence(timeout: 5),
      "Cancel request should appear in the shipping segment")
    XCTAssertFalse(
      app.buttons["Ask to buy"].exists,
      "Ask to buy should be hidden while an active request exists")

    app.segmentedControls.buttons["Pickup"].tap()
    cancelButton.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Cancel pickup confirmation sheet should appear")
    // The row button and the sheet's confirm button share the "Cancel request" label; tap the
    // hittable one (the confirm button on top of the sheet) so the archive action actually fires.
    let confirmCancelButton = try XCTUnwrap(
      waitForHittableButton(labeled: "Cancel request"),
      "Confirm cancel button should be tappable in the sheet")
    confirmCancelButton.tap()

    let requestArchived = try await waitForArchivedMarketplaceRequest(
      emitter: emitter,
      itemId: selectedItemId
    )
    XCTAssertTrue(requestArchived, "Cancel request should archive the active request")
    XCTAssertTrue(
      timeslot.waitForExistence(timeout: 10),
      "Pickup timeslot should return after cancelling the request")

    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should reopen after cancelling the request")
    tapConfirmationSheetRequestButton()
    XCTAssertTrue(
      app.buttons["Cancel request"].firstMatch.waitForExistence(timeout: 10),
      "Cancel request should reappear after creating another request")
    await emitter.disconnect()
  }

  @MainActor
  func testAskToBuyCreatesShippingRequestAndValidatesEmptyPostcode() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Shipping request item",
      pickupSelection: ["2026-06-03T09:00:00"],
      shippingFee: "0"
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Request shipping",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "dataChanged")

    let askToBuyButton = app.buttons["Ask to buy"]
    XCTAssertTrue(
      askToBuyButton.waitForExistence(timeout: 10), "Ask to buy button should be visible")
    askToBuyButton.tap()

    let missingInformationAlert = app.alerts["Missing information"]
    XCTAssertTrue(
      missingInformationAlert.waitForExistence(timeout: 5),
      "An empty shipping postcode should show the missing-information alert"
    )
    let requestsAfterEmptyPostcode = try await emitter.getResource(
      service: MARKETPLACE_SERVICE,
      resource: MarketplaceResource.requests.rawValue
    )
    XCTAssertFalse(
      Self.marketplaceRequestsContain(
        requestsAfterEmptyPostcode,
        type: "shipping",
        itemId: selectedItemId
      ),
      "An empty postcode must not create a shipping request"
    )
    let dismissAlertButton = missingInformationAlert.buttons.firstMatch
    XCTAssertTrue(dismissAlertButton.exists, "Missing-information alert should be dismissible")
    dismissAlertButton.tap()

    try fillShippingPostcodeAndAskToBuy()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Shipping confirmation sheet should appear after Ask to buy with a postcode")
    tapConfirmationSheetRequestButton()

    let shippingRequestCreated = try await waitForMarketplaceRequest(
      emitter: emitter,
      type: "shipping",
      itemId: selectedItemId,
      valueKey: "postalcode",
      value: "2018"
    )
    XCTAssertTrue(
      shippingRequestCreated,
      "Ask to buy should create a shipping request with the entered postcode"
    )
    await emitter.disconnect()
  }

  /// Requests shipping for a freshly created item and asserts which surcharge-aware copy
  /// appears in the confirmation sheet.
  @MainActor
  private func assertShippingConfirmationCopy(
    emitter: WSEmitter,
    titlePrefix: String,
    shippingFee: String,
    viewLabelPrefix: String,
    expectedCopy: String,
    expectedMessage: String,
    absentCopy: String,
    absentMessage: String,
    file: StaticString = #filePath,
    line: UInt = #line
  ) async throws {
    let (itemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: titlePrefix,
      pickupSelection: ["2026-06-03T09:00:00"],
      shippingFee: shippingFee
    )
    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: viewLabelPrefix,
      itemId: itemId
    )

    try fillShippingPostcodeAndAskToBuy()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Shipping confirmation sheet should open", file: file, line: line)
    XCTAssertTrue(
      app.staticTexts.containing(
        NSPredicate(format: "label CONTAINS %@", expectedCopy)
      ).firstMatch.waitForExistence(timeout: 5),
      expectedMessage, file: file, line: line)
    XCTAssertFalse(
      app.staticTexts.containing(
        NSPredicate(format: "label CONTAINS %@", absentCopy)
      ).firstMatch.waitForExistence(timeout: 2),
      absentMessage, file: file, line: line)
  }

  @MainActor
  func testShippingConfirmationSheetShowsSurchargeAwareCopy() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let heldPaymentCopy =
      "Your payment will be held on EVY until shipping has been confirmed (within 48 hours)."
    let noSurchargeCopy =
      "Shipping should be confirmed within 48 hours by the seller."

    try await assertShippingConfirmationCopy(
      emitter: emitter,
      titlePrefix: "Surcharge shipping item",
      shippingFee: "5",
      viewLabelPrefix: "Surcharge shipping",
      expectedCopy: heldPaymentCopy,
      expectedMessage: "Surcharge item confirmation should show the held-payment notice",
      absentCopy: noSurchargeCopy,
      absentMessage: "Surcharge item confirmation should not show the no-surcharge notice"
    )

    dismissConfirmationSheet()
    XCTAssertTrue(
      waitForConfirmationSheetDismissed(timeout: 5),
      "Shipping confirmation sheet should dismiss")

    try await assertShippingConfirmationCopy(
      emitter: emitter,
      titlePrefix: "Free shipping item",
      shippingFee: "0",
      viewLabelPrefix: "Free shipping",
      expectedCopy: noSurchargeCopy,
      expectedMessage: "No-surcharge item confirmation should show the 48-hour notice",
      absentCopy: heldPaymentCopy,
      absentMessage: "No-surcharge item confirmation should not show the held-payment notice"
    )
    await emitter.disconnect()
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

  // Synchronous on purpose (async bridged via `awaitResult`): heavy async UI tests hit an
  // Xcode 26 Swift-concurrency runtime crash ("freed pointer was not the last allocation",
  // swiftlang/swift#84793) that aborts the runner mid-test.
  @MainActor
  func testCreateItemFormEditing() throws {
    let createItemButton = app.buttons["Create"]
    XCTAssertTrue(
      createItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")
    let emitter = WSEmitter()
    let host = apiHost
    try awaitResult("emitter setup + flow push") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
      try await emitter.updateSDUI(
        flowData: Self.minimalCreateItemFlowData(),
        flowId: E2EFlowIds.webSocketCreateFlow
      )
    }
    // Relaunch after pushing the flow, matching the suite's push-then-relaunch pattern
    // (openViewItemPage) so the test exercises a cleanly synced flow graph.
    app.terminate()
    try launchApp()
    XCTAssertTrue(createItemButton.waitForExistence(timeout: 20), "Create button after relaunch")
    createItemButton.tap()

    let titleFieldId = "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
    let titleInput = try XCTUnwrap(findElement(identifier: titleFieldId), "Title field")
    let titleField = try XCTUnwrap(tapAndGetEditableField(container: titleInput), "Editable title")
    let testTitle = "Test Item Title \(Int(Date().timeIntervalSince1970))"
    clearAndType(field: titleField, text: testTitle, placeholder: "Item")
    XCTAssertTrue(
      (titleField.value as? String)?.contains(testTitle) == true,
      "Title field should retain typed text")
    dismissKeyboard()

    let priceTextField = try XCTUnwrap(
      findElementWithScroll(
        identifiers: [
          "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).price}",
          "textField_{buildCurrency(\(MARKETPLACE_ITEMS_RESOURCE_ID).price)}",
        ],
        containsAny: ["\(MARKETPLACE_ITEMS_RESOURCE_ID).price", "buildCurrency"],
        in: pageScrollView
      ), "Price field")
    let priceField = try XCTUnwrap(
      tapAndGetEditableField(container: priceTextField), "Editable price")
    clearAndType(field: priceField, text: "99", placeholder: "0")
    XCTAssertTrue(
      (priceField.value as? String)?.contains("99") == true,
      "Price field should retain typed value")
    dismissKeyboard()

    let widthTextField = try XCTUnwrap(
      findElementWithScroll(
        identifiers: ["textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).width}"],
        containsAny: ["\(MARKETPLACE_ITEMS_RESOURCE_ID).width"],
        in: pageScrollView
      ), "Width field")
    let widthField = try XCTUnwrap(
      tapAndGetEditableField(container: widthTextField), "Editable width")
    clearAndType(field: widthField, text: "50", placeholder: "0")
    XCTAssertTrue(
      (widthField.value as? String)?.contains("50") == true,
      "Width field should retain typed value")
    dismissKeyboard()

    let submitButton = app.buttons["Submit"]
    XCTAssertTrue(
      submitButton.waitForExistence(timeout: 10), "Submit should exist on minimal create flow")
    submitButton.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 10),
      "Submit confirmation sheet should appear")
    let submitConfirmButton = try XCTUnwrap(
      waitForHittableButton(labeled: "Submit"),
      "Submit button in confirmation sheet should be tappable")
    submitConfirmButton.tap()

    XCTAssertTrue(
      createItemButton.waitForExistence(timeout: 15),
      "Should return to home after create(item)")

    let itemsPayload = try awaitResult("fetch marketplace items") {
      try await emitter.getResource(
        service: MARKETPLACE_SERVICE, resource: MARKETPLACE_ITEMS_RESOURCE_ID)
    }
    XCTAssertTrue(
      Self.marketplaceItemsContainListing(
        title: testTitle, priceValue: 99, widthText: "50", items: itemsPayload),
      "Marketplace items should include listing with title, price.value 99, and width 50"
    )

    try awaitResult("emitter disconnect") { await emitter.disconnect() }
  }

  private static func viewItemNavigateAction(viewItemId: String?) -> String {
    guard let viewItemId else {
      return "{navigate(\(E2EFlowIds.webSocketViewFlow),\(E2EFlowIds.webSocketViewPage))}"
    }
    return
      "{navigate(\(E2EFlowIds.webSocketViewFlow),\(E2EFlowIds.webSocketViewPage),{\(MARKETPLACE_ITEMS_RESOURCE_ID): [\(viewItemId)]})}"
  }

  private func waitForArchivedMarketplaceRequest(
    emitter: WSEmitter,
    itemId: String
  ) async throws -> Bool {
    let deadline = Date().addingTimeInterval(10)
    repeat {
      let requests = try await emitter.getResource(
        service: MARKETPLACE_SERVICE,
        resource: MarketplaceResource.requests.rawValue
      )
      if Self.marketplaceRequestsArchived(requests, itemId: itemId) {
        return true
      }
    } while try await emitter.nextDataChanged(
      resource: MarketplaceResource.requests.rawValue, deadline: deadline)
    return false
  }

  private static func marketplaceRequestsArchived(
    _ requests: Any,
    itemId: String
  ) -> Bool {
    guard let requestRows = responseDataArray(from: requests) else { return false }
    return requestRows.contains { request in
      guard let requestData = request as? [String: Any],
        requestData["item_id"] as? String == itemId,
        requestData["archived"] as? Bool == true
      else { return false }
      return true
    }
  }

  private func waitForMarketplaceRequest(
    emitter: WSEmitter,
    type: String,
    itemId: String,
    valueKey: String,
    value: String
  ) async throws -> Bool {
    let deadline = Date().addingTimeInterval(10)
    repeat {
      let requests = try await emitter.getResource(
        service: MARKETPLACE_SERVICE,
        resource: MarketplaceResource.requests.rawValue
      )
      if Self.marketplaceRequestsContain(
        requests,
        type: type,
        itemId: itemId,
        valueKey: valueKey,
        value: value
      ) {
        return true
      }
    } while try await emitter.nextDataChanged(
      resource: MarketplaceResource.requests.rawValue, deadline: deadline)
    return false
  }

  private static func marketplaceRequestsContain(
    _ requests: Any,
    type: String,
    itemId: String,
    valueKey: String? = nil,
    value: String? = nil
  ) -> Bool {
    guard let requestRows = responseDataArray(from: requests) else { return false }
    return requestRows.contains { request in
      guard let requestData = request as? [String: Any],
        requestData["type"] as? String == type,
        requestData["item_id"] as? String == itemId
      else {
        return false
      }
      guard let valueKey, let value else { return true }
      return requestData[valueKey] as? String == value
    }
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

  @MainActor
  private func publishHomeFlow(_ flowData: [String: Any]) async {
    let emitter = WSEmitter()
    do {
      try await emitter.connect(host: apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      try await emitter.updateSDUI(
        flowData: flowData, flowId: E2EFlowIds.webSocketHomeFlow)
    } catch {
      XCTFail("Failed to publish home flow: \(error.localizedDescription)")
    }
    await emitter.disconnect()
  }

  @MainActor
  private func typeIntoHomeEphemeralField(_ text: String) async throws {
    guard let inputContainer = findElement(identifier: "textField_e2e.unrelated_input") else {
      XCTFail("Home input row should be visible")
      return
    }
    guard let inputField = tapAndGetEditableField(container: inputContainer) else {
      XCTFail("Failed to get editable home input field")
      return
    }
    clearAndType(field: inputField, text: text, placeholder: "Type here")
  }

  private func sharedHomeText(_ text: String) -> XCUIElement {
    app.staticTexts["Live: \(text)"]
  }

  private func headingHomeText(_ text: String) -> XCUIElement {
    app.staticTexts["Heading: \(text)"]
  }

  private func addedHomeText(_ text: String) -> XCUIElement {
    app.staticTexts["Added: \(text)"]
  }

  @MainActor
  func openViewItemPage(
    emitter: WSEmitter,
    labelPrefix: String,
    itemId: String,
    viewFlowDataBuilder: (String, String) -> [String: Any] = E2ETestBase.viewItemRequestFlowData,
    viewFlowId: String = E2EFlowIds.webSocketViewFlow,
    viewPageId: String = E2EFlowIds.webSocketViewPage,
    buttonExistenceMessage: String = "View button should load after relaunch"
  ) async throws -> String {
    let viewLabel = "\(labelPrefix) \(Int(Date().timeIntervalSince1970))"
    try await emitter.updateSDUI(
      flowData: createHomeFlowData(buttonLabel: viewLabel, viewItemId: itemId),
      flowId: E2EFlowIds.webSocketHomeFlow
    )
    try await emitter.updateSDUI(
      flowData: viewFlowDataBuilder(viewFlowId, viewPageId),
      flowId: viewFlowId
    )
    app.terminate()
    try launchApp()
    let viewButton = app.buttons[viewLabel]
    XCTAssertTrue(
      viewButton.waitForExistence(timeout: 20),
      buttonExistenceMessage)
    viewButton.tap()
    return viewLabel
  }

  @MainActor
  func fillShippingPostcodeAndAskToBuy(postcode: String = "2018") throws {
    let postcodeContainer = try XCTUnwrap(
      findElement(identifier: "textField_{shipping_address.postcode}"),
      "Shipping postcode input should be visible"
    )
    let editablePostcodeField = tapAndGetEditableField(container: postcodeContainer)
    let postcodeField = try XCTUnwrap(editablePostcodeField)
    clearAndType(field: postcodeField, text: postcode, placeholder: "Postcode")
    dismissKeyboard()
    app.buttons["Ask to buy"].tap()
  }

  private func createHomeFlowData(
    buttonLabel: String,
    viewItemId: String? = nil,
    includeAddedSharedRow: Bool = false,
    includeHeadingRow: Bool = false
  ) -> [String: Any] {
    let viewAction = Self.viewItemNavigateAction(viewItemId: viewItemId)

    var children: [[String: Any]] = []
    if includeHeadingRow {
      children.append(
        Self.headingRow(
          id: "b1c2d3e4-f5a6-4789-8012-3456789abcde",
          title: "Heading: {e2e.unrelated_input}"
        )
      )
    }
    children.append(contentsOf: [
      Self.inputRow(
        id: "c72107b6-a50f-4bdb-98d8-4f803e2e8e1b",
        title: "Notes",
        source: nil,
        placeholder: "Type here",
        destination: "e2e.unrelated_input"
      ),
      Self.textRow(
        id: "5af45c82-6b8a-4f33-9864-1c5f9eb47ed1",
        title: "Live: {e2e.unrelated_input}"
      ),
    ])
    if includeAddedSharedRow {
      children.append(
        Self.textRow(
          id: "9c1e7f4a-3b2d-4e6a-8f1c-2d3e4f5a6b7c",
          title: "Added: {e2e.unrelated_input}"
        )
      )
    }
    children.append(contentsOf: [
      Self.buttonRow(
        id: "53d04050-29f3-48ec-b55b-1a6a30fc2111",
        label: "Details",
        action:
          "{navigate(\(E2EFlowIds.webSocketHomeFlow),\(E2EFlowIds.webSocketHomeDetailsPage))}"
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
    ])

    return [
      "id": E2EFlowIds.webSocketHomeFlow,
      "name": "Home",
      "pages": [
        [
          "id": E2EFlowIds.webSocketHomePage,
          "title": "Home",
          "rows": [
            [
              "id": "a74bc80e-ffda-4e19-b8f3-cd882405958b",
              "type": "ListContainer",
              "actions": [],
              "visible": "true",
              "title": "",
              "children": children,
            ]
          ],
        ],
        [
          "id": E2EFlowIds.webSocketHomeDetailsPage,
          "title": "Details",
          "rows": [
            Self.textRow(
              id: "36dc56d0-706b-4d5a-bc2a-6dc6956c9277",
              title: "Details page"
            )
          ],
        ],
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
      let buttonIndex = children.firstIndex(where: { ($0["label"] as? String) == buttonLabel }),
      var actions = children[buttonIndex]["actions"] as? [[String: Any]],
      var firstAction = actions.first
    else {
      return flowData
    }

    var button = children[buttonIndex]
    firstAction["condition"] = "{1 > 0 || (0 > 1 && 2 > 3)}"
    actions[0] = firstAction
    button["actions"] = actions
    children[buttonIndex] = button
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
    app.launchEnvironment["HOME_FLOW_ID"] = "00000000-0000-4000-8000-000000000000"
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

// MARK: - Place search address sheet

final class E2EPlaceSearchTests: E2ETestBase {
  private static let placeSearchHomeFlowId = "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a"
  private static let placeSearchPageId = "e2f3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a6b"
  private static let placeSearchEntityId = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  private static let placeSearchQuery = "Sydney"

  override var homeFlowId: String? { Self.placeSearchHomeFlowId }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try seedFlows([
      (
        flowId: Self.placeSearchHomeFlowId,
        flowData: Self.placeSearchFlowData()
      )
    ])
    try launchApp()
  }

  func testSingleWordPlaceSearchSelectsAddressAndDismissesSheet() throws {
    let whereLabel = app.staticTexts["Where"]
    XCTAssertTrue(
      whereLabel.waitForExistence(timeout: 20),
      "Pickup address row should be visible - verify API is running and flow is seeded")

    whereLabel.tap()

    let searchField = app.textFields.firstMatch
    XCTAssertTrue(searchField.waitForExistence(timeout: 5), "Search field should appear in sheet")
    clearAndType(field: searchField, text: Self.placeSearchQuery)

    let result = app.staticTexts.matching(
      NSPredicate(
        format: "label CONTAINS[c] %@ AND label != %@",
        Self.placeSearchQuery,
        "Where"
      )
    ).firstMatch
    XCTAssertTrue(
      result.waitForExistence(timeout: 20),
      "Place search should return results for a single word without trailing space")
    result.tap()

    let sheetStillOpen = searchField.waitForExistence(timeout: 2)
    XCTAssertFalse(sheetStillOpen, "Search sheet should dismiss after selecting a result")

    let formattedAddress = app.staticTexts.matching(
      NSPredicate(format: "label CONTAINS[c] 'NSW' OR label CONTAINS[c] 'Australia'")
    ).firstMatch
    XCTAssertTrue(
      formattedAddress.waitForExistence(timeout: 10),
      "Pickup subtitle should reflect the written address")
  }

  private static func placeSearchFlowData() -> [String: Any] {
    let destination = "{\(placeSearchEntityId).transfer_options.pickup.address}"
    let subtitle = "{formatAddress(\(placeSearchEntityId).transfer_options.pickup.address)}"
    return [
      "id": placeSearchHomeFlowId,
      "name": "E2E Place Search",
      "pages": [
        [
          "id": placeSearchPageId,
          "title": "Pickup",
          "rows": [
            textActionRow(
              id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
              title: "Where",
              subtitle: subtitle,
              child: searchRow(
                id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6f",
                source: "{$api:place_search}",
                destination: destination,
                placeholder: "Search address",
                child: [
                  "id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                  "type": "Text",
                  "title": "{$datum.street}",
                  "subtitle": "{$datum.city}",
                  "actions": [],
                  "visible": "true",
                ]
              )
            )
          ],
        ]
      ],
    ]
  }

  private static func textActionRow(
    id: String,
    title: String,
    subtitle: String,
    action: String = "Change",
    child: [String: Any],
    visible: String = "true"
  ) -> [String: Any] {
    return [
      "id": id,
      "type": "TextAction",
      "visible": visible,
      "title": title,
      "subtitle": subtitle,
      "action": action,
      "actions": [
        [
          "condition": "",
          "false": "",
          "true": "{show()}",
        ]
      ],
      "child": child,
    ]
  }

  private static func searchRow(
    id: String,
    source: String,
    destination: String,
    placeholder: String,
    child: [String: Any],
    visible: String = "true"
  ) -> [String: Any] {
    return [
      "id": id,
      "type": "Search",
      "visible": visible,
      "title": "",
      "placeholder": placeholder,
      "source": source,
      "destination": destination,
      "actions": [],
      "child": child,
    ]
  }
}
