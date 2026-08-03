//
//  e2e.swift
//  evyUITests
//

import XCTest

private let MARKETPLACE_ITEMS_RESOURCE_ID = MarketplaceE2EFixture.itemsRef
private let MARKETPLACE_ITEM_STATUSES_RESOURCE_ID = MarketplaceE2EFixture.statusesRef
private let MARKETPLACE_SERVICE = MarketplaceE2EFixture.service

// MARK: - Minimal WebSocket Emitter for E2E Tests

actor WSEmitter {
  private var ws: URLSessionWebSocketTask?
  private var msgId = 0
  private var bufferedEvents: [[String: Any]] = []
  private var pendingResponses: [Int: CheckedContinuation<[String: Any], Error>] = [:]
  private var receiveTask: Task<Void, Never>?

  func connect(host: String) async throws {
    receiveTask?.cancel()
    receiveTask = nil
    pendingResponses = [:]
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
    startReceiveLoop()
  }

  private func startReceiveLoop() {
    receiveTask?.cancel()
    receiveTask = Task { await self.runReceiveLoop() }
  }

  private func runReceiveLoop() async {
    while !Task.isCancelled {
      guard let ws else { return }
      let message: URLSessionWebSocketTask.Message
      do {
        message = try await ws.receive()
      } catch {
        failPendingResponses(error)
        return
      }
      guard case .string(let text) = message,
        let data = text.data(using: .utf8),
        let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else {
        continue
      }
      if let responseId = jsonRpcId(from: response),
        let continuation = pendingResponses.removeValue(forKey: responseId)
      {
        if let error = response["error"] as? [String: Any] {
          let messageText = (error["message"] as? String) ?? "JSON-RPC error"
          let details = (error["data"] as? String).map { ": \($0)" } ?? ""
          continuation.resume(
            throwing: NSError(
              domain: "WSEmitter",
              code: (error["code"] as? Int) ?? -1,
              userInfo: [
                NSLocalizedDescriptionKey: "RPC failed: \(messageText)\(details)"
              ]
            )
          )
        } else {
          continuation.resume(returning: response)
        }
        continue
      }
      if response["method"] != nil {
        bufferedEvents.append(response)
      }
    }
  }

  private func failPendingResponses(_ error: Error) {
    let pending = pendingResponses
    pendingResponses = [:]
    for (_, continuation) in pending {
      continuation.resume(throwing: error)
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
      try await Task.sleep(for: .milliseconds(min(200, Int(remaining * 1000))))
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
    guard event["method"] as? String == "data_changed",
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
      try await upsertResource(resource: EVYCoreResource.rows.ref, id: row.id, data: row.data)
    }
    for page in graph.pages {
      try await upsertResource(
        resource: EVYCoreResource.pages.ref, id: page.id, data: page.data)
    }
    try await upsertResource(
      resource: EVYCoreResource.flows.ref,
      id: graph.flow.id,
      data: graph.flow.data
    )
  }

  private func upsertResource(resource: String, id: String, data: [String: Any]) async throws {
    let existing = try await getResource(
      resource: resource,
      filter: ["id": id]
    )
    let existingArray = existing as? [Any]
    let method = existingArray?.isEmpty == false ? "update" : "create"
    let params: [String: Any] = [
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
    var flowRow: [String: Any] = [
      "id": flowId,
      "name": nonEmptyString(flowData["name"]) ?? "Flow",
      "page_ids": pages.map(\.id),
      "visibility": "public",
      "created_at": now,
      "updated_at": now,
    ]
    if let submits = flowData["submits"] as? [String: Any] {
      flowRow["submits"] = submits
    }
    return ((flowId, flowRow), pages, rows)
  }

  private func decomposePage(
    pageData: [String: Any],
    rows: inout [(id: String, data: [String: Any])],
    now: String
  ) -> (id: String, data: [String: Any]) {
    let pageId = (pageData["id"] as? String) ?? UUID().uuidString
    let rowInputs = pageData["rows"] as? [[String: Any]] ?? []
    let row_ids = rowInputs.map { rowData in
      decomposeRow(rowData: rowData, rows: &rows, now: now)
    }
    let footer_row_id = (pageData["footer"] as? [String: Any]).map { footerData in
      decomposeRow(rowData: footerData, rows: &rows, now: now)
    }
    var pageRow: [String: Any] = [
      "id": pageId,
      "name": nonEmptyString(pageData["name"]) ?? nonEmptyString(pageData["title"]) ?? "Page",
      "title": (pageData["title"] as? String) ?? "",
      "row_ids": row_ids,
      "visibility": "public",
      "created_at": now,
      "updated_at": now,
    ]
    if let footer_row_id { pageRow["footer_row_id"] = footer_row_id }
    return (pageId, pageRow)
  }

  private func decomposeRow(
    rowData: [String: Any],
    rows: inout [(id: String, data: [String: Any])],
    now: String
  ) -> String {
    let rowId = (rowData["id"] as? String) ?? UUID().uuidString
    var data = rowData
    for key in ["id", "name", "type", "visible", "child", "children", "sheet"] {
      data.removeValue(forKey: key)
    }
    if let sheet = rowData["sheet"] as? [String: Any] {
      data["sheet_row_id"] = decomposeRow(rowData: sheet, rows: &rows, now: now)
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
      "type": (rowData["type"] as? String) ?? "text",
      "visible": (rowData["visible"] as? String) ?? "true",
      "data": data,
      "visibility": "public",
      "created_at": now,
      "updated_at": now,
    ]
    rows.append((rowId, row))
    return rowId
  }

  private func nonEmptyString(_ value: Any?) -> String? {
    guard let string = value as? String, !string.isEmpty else { return nil }
    return string
  }

  func getResource(resource: String, filter: [String: Any]? = nil) async throws
    -> Any
  {
    var params: [String: Any] = ["resource": resource]
    if let filter = filter {
      params["filter"] = filter
    }
    return try await rpcResult(method: "get", params: params)
  }

  func createResource(
    resource: String,
    filter: [String: Any]? = nil,
    data: [String: Any]
  ) async throws -> Any {
    var params: [String: Any] = ["resource": resource, "data": data]
    if let filter = filter {
      params["filter"] = filter
    }
    return try await rpcResult(method: "create", params: params)
  }

  func updateResource(
    resource: String,
    filter: [String: Any],
    data: [String: Any]
  ) async throws -> Any {
    let params: [String: Any] = [
      "resource": resource,
      "filter": filter,
      "data": data,
    ]
    return try await rpcResult(method: "update", params: params)
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

  func callApi(service: String, method: String, data: [String: Any]) async throws -> Any {
    return try await rpcResult(
      method: "api",
      params: ["service": service, "method": method, "data": data]
    )
  }

  func disconnect() {
    receiveTask?.cancel()
    receiveTask = nil
    failPendingResponses(
      NSError(
        domain: "WSEmitter", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "disconnected"]))
    ws?.cancel(with: .normalClosure, reason: nil)
    ws = nil
  }

  private func failPendingRequest(id: Int, error: Error) {
    if let continuation = pendingResponses.removeValue(forKey: id) {
      continuation.resume(throwing: error)
    }
  }

  private func send(method: String, params: Any) async throws -> [String: Any] {
    msgId += 1
    let requestId = msgId
    let msg: [String: Any] = [
      "jsonrpc": "2.0", "id": requestId, "method": method, "params": params,
    ]
    let json = String(data: try JSONSerialization.data(withJSONObject: msg), encoding: .utf8)!
    guard let ws else {
      throw NSError(
        domain: "WSEmitter", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "socket not connected"])
    }
    return try await withCheckedThrowingContinuation { continuation in
      pendingResponses[requestId] = continuation
      ws.send(.string(json)) { error in
        guard let error else { return }
        Task { await self.failPendingRequest(id: requestId, error: error) }
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
      "submits": [
        "resource": MARKETPLACE_ITEMS_RESOURCE_ID
      ],
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
              destination:
                "{\(MARKETPLACE_ITEMS_RESOURCE_ID).price: {value: $datum, currency: \"AUD\"}}"
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
            "type": "button",
            "visible": "true",
            "title": "",
            "label": "Submit",
            "actions": Self.actionsObject(
              tap: [
                [
                  "condition": "",
                  "false": "",
                  "true": "{show(a4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d)}",
                ]
              ]
            ),
            "sheet": Self.submitListingSheetChild(
              createAction:
                "{create(\(MARKETPLACE_ITEMS_RESOURCE_ID), submit)}"
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

  static func responseDataArray(from response: Any) -> [Any]? {
    if let envelope = response as? [String: Any] {
      return envelope["data"] as? [Any]
    }
    return response as? [Any]
  }

  func waitForResourceUpdate(
    emitter: WSEmitter,
    resource: String,
    timeout: TimeInterval = 10,
    matches: (Any) -> Bool
  ) async throws -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    repeat {
      let payload = try await emitter.getResource(resource: resource)
      if matches(payload) {
        return true
      }
    } while try await emitter.nextDataChanged(resource: resource, deadline: deadline)
    return false
  }

  /// Waits for a response message naming `messageId` in `parent_message_id`.
  func waitForMessageResponse(
    emitter: WSEmitter,
    messageId: String,
    value: String
  ) async throws -> Bool {
    try await waitForResourceUpdate(
      emitter: emitter, resource: EVYCoreResource.messages.ref
    ) { Self.messageHasResponse($0, messageId: messageId, value: value) != nil }
  }

  static func messageHasResponse(
    _ messages: Any,
    messageId: String,
    value: String
  ) -> String? {
    guard let messageRows = responseDataArray(from: messages) else { return nil }
    for message in messageRows {
      guard let messageData = message as? [String: Any],
        messageData["parent_message_id"] as? String == messageId,
        messageData["value"] as? String == value,
        let id = messageData["id"] as? String
      else { continue }
      return id
    }
    return nil
  }

  /// Scrolls the enclosing scroll view until `element` can actually be interacted with.
  /// `exists` is true for an offscreen row, and swiping one fails with an empty frame.
  @MainActor
  func scrollUntilHittable(_ element: XCUIElement, attempts: Int = 6) -> Bool {
    if element.isHittable { return true }
    let scrollView = app.scrollViews.firstMatch
    for _ in 0..<attempts {
      scrollView.swipeUp()
      if element.isHittable { return true }
    }
    return element.isHittable
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
    // Never tap a field that already has keyboard focus: on pages, EVYPage's tap-to-dismiss
    // gesture fires for taps on the field too, resigning first responder and unmounting the
    // TextField (EVYTextField only renders a TextField while editing).
    if (field.value(forKey: "hasKeyboardFocus") as? Bool) != true {
      field.tap()
    }
    if let existingText = field.value as? String, !existingText.isEmpty {
      let shouldClearExistingText = placeholder == nil || existingText != placeholder
      if shouldClearExistingText {
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

  typealias OwnedResourceDeclaration = (
    resource: String, ids: [String]
  )

  var ownedResources: [OwnedResourceDeclaration] { [] }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try launchApp()
  }

  var apiHost: String { ProcessInfo.processInfo.environment["API_HOST"] ?? "127.0.0.1:8000" }

  func launchApp() throws {
    app = XCUIApplication()
    app.launchEnvironment["API_HOST"] = apiHost
    if let homeFlowId {
      app.launchEnvironment["HOME_FLOW_ID"] = homeFlowId
    }
    if !ownedResources.isEmpty {
      let declared = ownedResources.map {
        ["resource": $0.resource, "ids": $0.ids] as [String: Any]
      }
      let encoded = try JSONSerialization.data(withJSONObject: declared)
      app.launchEnvironment["EVY_OWNED_RESOURCES"] = String(
        decoding: encoded, as: UTF8.self)
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

  static func productionHomeFlowData() throws -> [String: Any] {
    let fixtureURL = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()  // e2e
      .deletingLastPathComponent()  // ios
      .deletingLastPathComponent()  // repo root
      .appendingPathComponent("scripts/fixtures/evy/evy_sdui.json")
    let data = try Data(contentsOf: fixtureURL)
    let json = try JSONSerialization.jsonObject(with: data)
    guard let flowData = json as? [String: Any] else {
      throw NSError(
        domain: "E2E", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Invalid production home fixture JSON"])
    }
    return flowData
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
              "type": "vertical_container",
              "actions": [:],
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
      "type": text.isEmpty ? "text" : "text_expand",
      "actions": [:],
      "visible": visible,
      "title": title,
    ]
    if text.isEmpty {
      row["subtitle"] = subtitle
      row["label"] = ""
    } else {
      row["text"] = text
      row["expand_label"] = "Read more"
      row["actions"] = Self.actionsObject(
        tap: [Self.rowAction(true: "{expand_text(\(id))}")]
      )
    }
    if !name.isEmpty {
      row["name"] = name
    }
    return row
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
      "type": "input",
      "visible": visible,
      "title": title,
      "placeholder": placeholder,
      "destination": destination,
      "actions": [:],
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
    sheet: [String: Any]? = nil
  ) -> [String: Any] {
    let resolvedActions: [[String: Any]]
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
      "type": "button",
      "visible": visible,
      "title": "",
      "label": label,
      "actions": Self.actionsObject(tap: resolvedActions),
    ]
    if let style {
      row["style"] = style
    }
    if let sheet {
      row["sheet"] = sheet
    }
    return row
  }

  static func headingRow(
    id: String,
    title: String
  ) -> [String: Any] {
    return [
      "id": id,
      "type": "heading",
      "actions": [:],
      "visible": "true",
      "title": title,
      "label": "",
    ]
  }

  static func rowAction(
    true action: String,
    condition: String = "",
    false falseAction: String = ""
  ) -> [String: Any] {
    [
      "condition": condition,
      "false": falseAction,
      "true": action,
    ]
  }

  static func actionsObject(
    tap: [[String: Any]] = [],
    swipeLeft: [[String: Any]] = []
  ) -> [String: Any] {
    var result: [String: Any] = [:]
    if !tap.isEmpty {
      result["tap"] = tap
    }
    if !swipeLeft.isEmpty {
      result["swipe_left"] = swipeLeft
    }
    return result
  }

  /// Nothing arranged or being arranged: the exact complement of the three `Active … request`
  /// gates, term for term. The tab container holds all three request controls, so while one
  /// arrangement is live the page shows that one alone.
  static func noArrangementLiveVisibilityExpression() -> String {
    let terms = ["pickup", "delivery", "shipping"].flatMap { type -> [String] in
      let latest = latestMessageExpression(type: type)
      return ["\(latest).value != \"pending\"", "\(latest).value != \"accept\""]
    }
    return "{\(terms.joined(separator: " && "))}"
  }

  /// The latest message about one transfer method for the item. Everything the item page
  /// shows is a read of `value` off this - see `docs/evy/data.md`.
  static func latestMessageExpression(type: String) -> String {
    let messagesRef = EVYCoreResource.messages.ref
    let itemRef = MARKETPLACE_ITEMS_RESOURCE_ID
    return
      "findFirst(sort(\(messagesRef), desc, created_at), fk == \(itemRef).id && type == \(type))"
  }

  static let messageCreateEnvelope =
    "fk: {\(MARKETPLACE_ITEMS_RESOURCE_ID).id}, resource: \(MARKETPLACE_ITEMS_RESOURCE_ID)"

  static func requestCreateAction(type: String, payload: String) -> String {
    let messagesResourceId = EVYCoreResource.messages.ref
    return
      "{create(\(messagesResourceId),{\(messageCreateEnvelope), type: \(type), value: pending, data: {\(payload)}})}"
  }

  /// Cancel is offered while the request is open, and each transfer method is independent, so
  /// the pickers gate on their own method rather than on anything page-wide.
  static func cancelRequestVisibilityExpressions(type: String) -> (
    hasActive: String, noActive: String
  ) {
    let latest = latestMessageExpression(type: type)
    let hasActive = "{\(latest).value == \"pending\"}"
    // Nothing in flight for this method: `reject`, `cancel` and "nothing yet" all land here.
    let noActive =
      "{\(latest).value != \"pending\" && \(latest).value != \"accept\"}"
    return (hasActive, noActive)
  }

  /// A separate message says a request was accepted, and it carries the request's payload
  /// forward - which is what the confirmation row reads the agreed time from.
  static func acceptedRequestVisibilityExpression(type: String) -> String {
    "{\(latestMessageExpression(type: type)).value == \"accept\"}"
  }

  static func hideSegmentInfoWhenAcceptedVisibilityExpression(type: String) -> String {
    "{\(latestMessageExpression(type: type)).value != \"accept\"}"
  }

  /// The request container stays up while the request is open and once it has been accepted -
  /// the confirmation row lives inside it. Exact complement of the picker's gate.
  static func activeRequestVisibilityExpression(type: String) -> String {
    let latest = latestMessageExpression(type: type)
    return "{\(latest).value == \"pending\" || \(latest).value == \"accept\"}"
  }

  static func pendingRequestVisibilityExpression(type: String) -> String {
    "{\(latestMessageExpression(type: type)).value == \"pending\"}"
  }

  static func cancelRequestButtonLabel(type: String) -> String {
    "Cancel \(type) request"
  }

  static func activeRequestContainer(
    id: String,
    type: String,
    name: String,
    children: [[String: Any]]
  ) -> [String: Any] {
    [
      "id": id,
      "type": "vertical_container",
      "actions": [:],
      "visible": Self.activeRequestVisibilityExpression(type: type),
      "title": "",
      "name": name,
      "children": children,
    ]
  }

  static func timeAcceptedConfirmationSubtitle(type: String) -> String {
    let capitalizedType = type.prefix(1).uppercased() + type.dropFirst()
    let match = latestMessageExpression(type: type)
    return
      "\(capitalizedType) confirmed for {formatDatetime(\(match).data.time, \"EEE do\")} at {formatDatetime(\(match).data.time, \"HH:mm\")}"
  }

  static func shippingAcceptedConfirmationSubtitle() -> String {
    "Shipping confirmed"
  }

  /// Once a request is answered the message carries the full address, so the accepted state
  /// renders that instead of the public postcode. Pickup reads the seller's address off the
  /// accept; delivery and shipping read the buyer's own destination off the request, which the
  /// accept forwards.
  static func acceptedAddressRow(
    id: String,
    type: String,
    key: String,
    title: String,
    name: String
  ) -> [String: Any] {
    let match = latestMessageExpression(type: type)
    return Self.textRow(
      id: id,
      title: title,
      subtitle: "{formatAddress(\(match).data.\(key))}",
      visible: Self.acceptedRequestVisibilityExpression(type: type),
      name: name
    )
  }

  static func acceptedPickupAddressMapRow(id: String) -> [String: Any] {
    let match = latestMessageExpression(type: "pickup")
    return [
      "id": id,
      "type": "map",
      "actions": [:],
      "source": "{\(match).data.pickup_address}",
      "visible": Self.acceptedRequestVisibilityExpression(type: "pickup"),
      "title": "Pickup address",
      "subtitle": "{formatAddress(\(match).data.pickup_address)}",
      "name": "Pickup address",
    ]
  }

  static func viewItemCancelRequestFlowData(flowId: String, pageId: String) -> [String: Any] {
    let messagesResourceId = EVYCoreResource.messages.ref
    // Each transfer method gates on its own latest message, so a live pickup request leaves
    // delivery and shipping requestable. The tab container never hides - gating it is what
    // made the three mutually exclusive.
    let pickupVisibility = cancelRequestVisibilityExpressions(type: "pickup")
    let deliveryVisibility = cancelRequestVisibilityExpressions(type: "delivery")
    let shippingVisibility = cancelRequestVisibilityExpressions(type: "shipping")
    let pickupCreateAction = requestCreateAction(
      type: "pickup", payload: "time: {selected_pickup_timeslot}")
    let deliveryCreateAction = requestCreateAction(
      type: "delivery",
      payload: "time: {selected_delivery_timeslot}, destination_address: delivery_address")
    let shippingCreateAction = requestCreateAction(
      type: "shipping",
      payload:
        "postalcode: {shipping_address.postcode}, destination_address: shipping_address")
    func cancelAction(type: String) -> String {
      let latest = latestMessageExpression(type: type)
      return "{create(\(messagesResourceId),{\(messageCreateEnvelope),"
        + " parent_message_id: {\(latest).id}, value: cancel, type: \(type), data: {time: {\(latest).data.time}, postalcode: {\(latest).data.postalcode}, destination_address: {\(latest).data.destination_address}}})}"
    }

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
              "type": "tab_container",
              "actions": Self.actionsObject(
                tap: [Self.rowAction(true: "{select($datum)}")]
              ),
              "visible": Self.noArrangementLiveVisibilityExpression(),
              "title": "",
              "segments": ["Pickup", "Delivery", "Shipping"],
              "children": [
                [
                  "id": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
                  "type": "vertical_container",
                  "actions": [:],
                  "visible": "true",
                  "title": "",
                  "children": [
                    Self.timeslotPickerRow(
                      id: "b3c4d5e6-f7a8-4b9c-0d1e-2f3a4b5c6d7e",
                      source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).pickup_selection}",
                      actions: [
                        Self.rowAction(true: "{show(b8c7d6e5-f4a3-4b2c-9d1e-0f8a7b6c5d4e)}")
                      ],
                      visible: pickupVisibility.noActive,
                      name: "Pickup request times",
                      sheet: Self.pickupConfirmationSheetChild(
                        pickupCreateAction: pickupCreateAction
                      )
                    )
                  ],
                ],
                [
                  "id": "d5e6f7a8-b9c0-4d1e-2f3a-4b5c6d7e8f9a",
                  "type": "vertical_container",
                  "actions": [:],
                  "visible": "true",
                  "title": "",
                  "children": [
                    Self.textRow(
                      id: "357d3351-93e6-47bd-91ab-3616fd70b8aa",
                      title: "",
                      subtitle: "Buyer will drop off",
                      name: "Drop-off note"
                    ),
                    Self.timeslotPickerRow(
                      id: "e6f7a8b9-c0d1-4e2f-3a4b-5c6d7e8f9a0b",
                      source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).delivery_selection}",
                      destination: "{selected_delivery_timeslot}",
                      actions: [
                        Self.rowAction(true: "{show(c4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e80)}")
                      ],
                      visible: deliveryVisibility.noActive,
                      name: "Delivery request times",
                      sheet: Self.deliveryConfirmationSheetChild(
                        deliveryCreateAction: deliveryCreateAction
                      )
                    ),
                  ],
                ],
                [
                  "id": "a8b9c0d1-e2f3-4a4b-5c6d-7e8f9a0b1c2d",
                  "type": "vertical_container",
                  "actions": [:],
                  "visible": "true",
                  "title": "",
                  "children": [
                    Self.textRow(
                      id: "4aac26f8-7c51-4c09-a6ac-910e5636cbb5",
                      title: "",
                      subtitle: "Delivered to your door",
                      name: "Shipping note"
                    ),
                    Self.inputRow(
                      id: "b9c0d1e2-f3a4-4b5c-6d7e-8f9a0b1c2d3e",
                      title: "Shipping postcode",
                      source: nil,
                      placeholder: "Postcode",
                      destination: "{shipping_address.postcode}",
                      visible: shippingVisibility.noActive
                    ),
                    Self.buttonRow(
                      id: "c0d1e2f3-a4b5-4c6d-7e8f-9a0b1c2d3e4f",
                      label: "Ask to buy",
                      action: "{show(f2a1b0c9-d8e7-4f6a-5b4c-3d2e1f0a9b8c)}",
                      condition: "{length(shipping_address.postcode) > 0}",
                      falseAction: "{highlight_required(postcode)}",
                      visible: shippingVisibility.noActive,
                      sheet: Self.shippingConfirmationSheetChild(
                        shippingCreateAction: shippingCreateAction
                      )
                    ),
                  ],
                ],
              ],
            ],
            Self.activeRequestContainer(
              id: "f9a8b7c6-d5e4-4f3a-9b8c-7d6e5f4a3b2c",
              type: "pickup",
              name: "Active pickup request",
              children: [
                Self.textRow(
                  id: "1a713180-a4a4-4f23-98cf-f3e79140c832",
                  title: "",
                  subtitle: Self.timeAcceptedConfirmationSubtitle(type: "pickup"),
                  visible: Self.acceptedRequestVisibilityExpression(type: "pickup"),
                  name: "Pickup accepted confirmation"
                ),
                Self.acceptedPickupAddressMapRow(
                  id: "c7d8e9fa-0b1c-4d2e-8f3a-4b5c6d7e8f90"
                ),
                Self.buttonRow(
                  id: "c4d5e6f7-a8b9-4c0d-1e2f-3a4b5c6d7e8f",
                  label: Self.cancelRequestButtonLabel(type: "pickup"),
                  action: "{show(\(Self.cancelRequestSheetId(type: "pickup")))}",
                  visible: Self.pendingRequestVisibilityExpression(type: "pickup"),
                  style: "danger",
                  sheet: Self.cancelRequestSheetChild(
                    type: "pickup",
                    cancelAction: cancelAction(type: "pickup"),
                    message:
                      "Cancel pickup request for the \"{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}\"?"
                  )
                ),
              ]
            ),
            Self.activeRequestContainer(
              id: "e8a7b6c5-d4e3-4f2a-8b9c-6d5e4f3a2b1c",
              type: "delivery",
              name: "Active delivery request",
              children: [
                Self.textRow(
                  id: "0fa0adba-aab4-4a0e-a8a4-fa1236f7dd9c",
                  title: "",
                  subtitle: Self.timeAcceptedConfirmationSubtitle(type: "delivery"),
                  visible: Self.acceptedRequestVisibilityExpression(type: "delivery"),
                  name: "Delivery accepted confirmation"
                ),
                Self.acceptedAddressRow(
                  id: "d8e9fa0b-1c2d-4e3f-8a4b-5c6d7e8f9a01",
                  type: "delivery",
                  key: "destination_address",
                  title: "Delivering to",
                  name: "Delivery address"
                ),
                Self.textRow(
                  id: "357d3351-93e6-47bd-91ab-3616fd70b8aa",
                  title: "",
                  subtitle: "Buyer will drop off",
                  visible: Self.hideSegmentInfoWhenAcceptedVisibilityExpression(type: "delivery"),
                  name: "Drop-off note"
                ),
                Self.buttonRow(
                  id: "f7a8b9c0-d1e2-4f3a-4b5c-6d7e8f9a0b1c",
                  label: Self.cancelRequestButtonLabel(type: "delivery"),
                  action: "{show(\(Self.cancelRequestSheetId(type: "delivery")))}",
                  visible: Self.pendingRequestVisibilityExpression(type: "delivery"),
                  style: "danger",
                  sheet: Self.cancelRequestSheetChild(
                    type: "delivery",
                    cancelAction: cancelAction(type: "delivery"),
                    message:
                      "Cancel delivery request for the \"{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}\"?"
                  )
                ),
              ]
            ),
            Self.activeRequestContainer(
              id: "d7b6a5c4-e3f2-4a1b-9c8d-5e4f3a2b1c0d",
              type: "shipping",
              name: "Active shipping request",
              children: [
                Self.textRow(
                  id: "ba000cfa-6a3b-4817-8296-0c14f77bc199",
                  title: "",
                  subtitle: Self.shippingAcceptedConfirmationSubtitle(),
                  visible: Self.acceptedRequestVisibilityExpression(type: "shipping"),
                  name: "Shipping accepted confirmation"
                ),
                Self.acceptedAddressRow(
                  id: "e9fa0b1c-2d3e-4f4a-8b5c-6d7e8f9a0b12",
                  type: "shipping",
                  key: "destination_address",
                  title: "Shipping to",
                  name: "Shipping address"
                ),
                Self.textRow(
                  id: "4aac26f8-7c51-4c09-a6ac-910e5636cbb5",
                  title: "",
                  subtitle: "Delivered to your door",
                  visible: Self.hideSegmentInfoWhenAcceptedVisibilityExpression(type: "shipping"),
                  name: "Shipping note"
                ),
                Self.buttonRow(
                  id: "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a",
                  label: Self.cancelRequestButtonLabel(type: "shipping"),
                  action: "{show(\(Self.cancelRequestSheetId(type: "shipping")))}",
                  visible: Self.pendingRequestVisibilityExpression(type: "shipping"),
                  style: "danger",
                  sheet: Self.cancelRequestSheetChild(
                    type: "shipping",
                    cancelAction: cancelAction(type: "shipping"),
                    message:
                      "Cancel shipping request for the \"{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}\"?"
                  )
                ),
              ]
            ),
          ],
        ]
      ],
    ]
  }

  static func timeslotPickerRow(
    id: String,
    source: String,
    destination: String = "{selected_pickup_timeslot}",
    actions: [[String: Any]] = [],
    visible: String = "true",
    name: String = "Pickup available times",
    sheet: [String: Any]? = nil
  ) -> [String: Any] {
    var row: [String: Any] = [
      "id": id,
      "type": "timeslot_picker",
      "source": source,
      "destination": destination,
      "actions": Self.actionsObject(
        tap: [Self.rowAction(true: "{select($datum)}")] + actions
      ),
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
    if let sheet {
      row["sheet"] = sheet
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
    button["actions"] = Self.actionsObject(
      tap: [
        Self.rowAction(true: action),
        Self.rowAction(true: "{close()}"),
      ]
    )
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
      "type": "vertical_container",
      "actions": [:],
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
            "Request to pick up {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} on {formatDatetime(selected_pickup_timeslot, \"EEE do\")} at {formatDatetime(selected_pickup_timeslot, \"HH:mm\")}",
          name: "Pickup confirmation message"
        ),
        Self.textRow(
          id: "d0e9f8a7-b6c5-4d4e-9f3a-2b0c9d8e7f6a",
          title: "",
          subtitle:
            "Be advised someone may request to pick up {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} earlier than your selected timeslot.",
          visible:
            "{selected_pickup_timeslot != findFirst(sort(\(MARKETPLACE_ITEMS_RESOURCE_ID).pickup_selection, asc))}",
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

  private static let cancelRequestSheetSuffixes: [String: (sheet: String, row: String)] = [
    "pickup": ("d", "e"),
    "delivery": ("e", "f"),
    "shipping": ("f", "a"),
  ]

  /// Rows are stored globally by id, so each transfer method needs its own sheet: a shared id
  /// means the last one seeded wins and every cancel button shows that method's action.
  static func cancelRequestSheetId(type: String) -> String {
    let sheetSuffix = cancelRequestSheetSuffixes[type]?.sheet ?? "f"
    return "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5\(sheetSuffix)"
  }

  static func cancelRequestSheetChild(
    type: String,
    cancelAction: String,
    message: String
  ) -> [String: Any] {
    let rowSuffix = cancelRequestSheetSuffixes[type]?.row ?? "a"
    return Self.confirmationSheetChild(
      id: cancelRequestSheetId(type: type),
      name: "Cancel \(type) confirmation sheet",
      messageRows: [
        Self.textRow(
          id: "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6\(rowSuffix)",
          title: "",
          subtitle: message,
          name: "Cancel \(type) confirmation message"
        )
      ],
      confirmButton: Self.confirmSheetButton(
        id: "f3a4b5c6-d7e8-4f9a-0b1c-2d3e4f5a6b7\(rowSuffix)",
        label: "Cancel request",
        action: cancelAction,
        name: "Confirm cancel \(type) request",
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
    var confirmActions =
      (confirmButton["actions"] as? [String: Any])?["tap"] as? [[String: Any]] ?? []
    confirmActions.append(
      Self.rowAction(
        true: "{navigate(\(E2EFlowIds.defaultHomeFlow),\(E2EFlowIds.webSocketHomePage))}"))
    confirmButton["actions"] = Self.actionsObject(tap: confirmActions)

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
              "type": "tab_container",
              "actions": Self.actionsObject(
                tap: [Self.rowAction(true: "{select($datum)}")]
              ),
              "visible": "true",
              "title": "",
              "segments": ["Pickup"],
              "children": [
                [
                  "id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
                  "type": "vertical_container",
                  "actions": [:],
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
    let pickupCreateAction = requestCreateAction(
      type: "pickup", payload: "time: {selected_pickup_timeslot}")
    let shippingCreateAction = requestCreateAction(
      type: "shipping",
      payload:
        "postalcode: {shipping_address.postcode}, destination_address: shipping_address")

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
                Self.rowAction(true: "{show(b8c7d6e5-f4a3-4b2c-9d1e-0f8a7b6c5d4e)}")
              ],
              name: "Pickup request times",
              sheet: Self.pickupConfirmationSheetChild(pickupCreateAction: pickupCreateAction)
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
              action: "{show(f2a1b0c9-d8e7-4f6a-5b4c-3d2e1f0a9b8c)}",
              condition: "{length(shipping_address.postcode) > 0}",
              falseAction: "{highlight_required(postcode)}",
              sheet: Self.shippingConfirmationSheetChild(
                shippingCreateAction: shippingCreateAction
              )
            ),
          ],
        ]
      ],
    ]
  }

  static let homeInboxForYouChildRowId = "95444ce6-d4be-4001-8798-213cce23afd8"
  static let homeInboxFromYouChildRowId = "373ff30f-dc80-425c-a382-fadc8fcdcd81"
  static let homeInboxPickupHandshakeChildRowId = "e7d6c5b4-a392-4f1e-8c0b-9a8f7e6d5c4b"
  static let homeInboxScheduledSellerShippingChildRowId =
    "73625140-3928-4103-1e5f-4e4b7a958473"
  static let homeInboxScheduledBuyerDeliveryChildRowId =
    "065e4b7a-9584-4763-0425-a190817065e4"

  static func homeInboxTabRow() throws -> [String: Any] {
    let flowData = try productionHomeFlowData()
    guard let pages = flowData["pages"] as? [[String: Any]],
      let page = pages.first,
      let rows = page["rows"] as? [[String: Any]],
      let tabRow = rows.first(where: { ($0["type"] as? String) == "tab_container" })
    else {
      throw NSError(
        domain: "E2E", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Home fixture missing tab_container row"])
    }
    return tabRow
  }

  static func senderViewFlowData(flowId: String, pageId: String) -> [String: Any] {
    let createAction = requestCreateAction(
      type: "pickup", payload: "time: {selected_pickup_timeslot}")

    let picker = Self.timeslotPickerRow(
      id: "20000000-0000-4000-8000-000000000001",
      source: "{\(MARKETPLACE_ITEMS_RESOURCE_ID).pickup_selection}",
      actions: [Self.rowAction(true: "{show(b8c7d6e5-f4a3-4b2c-9d1e-0f8a7b6c5d4e)}")],
      name: "Pickup request times",
      sheet: Self.pickupConfirmationSheetChild(pickupCreateAction: createAction)
    )

    return [
      "id": flowId,
      "name": "E2E Message Sender",
      "pages": [
        [
          "id": pageId,
          "title": "Requests",
          "rows": [picker],
        ]
      ],
    ]
  }

  static func sheetPresentationAndReactivityFlowData(flowId: String, pageId: String) -> [String:
    Any]
  {
    [
      "id": flowId,
      "name": "E2E Sheet Presentation And Reactivity",
      "pages": [
        [
          "id": pageId,
          "title": "Sheet tests",
          "rows": [
            Self.buttonRow(
              id: "f8e7d6c5-b4a3-4f2e-9d1c-0b9a8f7e6d5c",
              label: "Open sheet",
              action: "{show(a9f8e7d6-c5b4-4a3f-2e1d-0c9b8a7f6e5d)}",
              sheet: [
                "id": "a9f8e7d6-c5b4-4a3f-2e1d-0c9b8a7f6e5d",
                "type": "vertical_container",
                "actions": [:],
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
            ),
            Self.buttonRow(
              id: "10000000-0000-4000-8000-00000000000c",
              label: "Open cross-page sheet",
              action: "{show(\(crossPageSheetRowId))}"
            ),
          ],
        ],
        [
          "id": crossPageSheetHostPageId,
          "title": "Sheet host",
          "rows": [
            [
              "id": crossPageSheetRowId,
              "type": "vertical_container",
              "actions": [:],
              "visible": "true",
              "title": "Confirmation",
              "children": [
                Self.textRow(
                  id: "10000000-0000-4000-8000-00000000000d",
                  title: "",
                  subtitle: "Opened sheet row from another page",
                  name: "Cross-page sheet message"
                ),
                Self.buttonRow(
                  id: "10000000-0000-4000-8000-00000000000e",
                  label: "Done",
                  action: "{close()}"
                ),
              ],
              "name": "Cross-page sheet",
            ]
          ],
        ],
      ],
    ]
  }

  private static let crossPageSheetHostPageId = "10000000-0000-4000-8000-00000000000a"
  private static let crossPageSheetRowId = "10000000-0000-4000-8000-00000000000b"

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
    // Lowercased to match the canonical form Postgres `uuid` columns (e.g. core
    // Message.fk) normalize values to on storage/retrieval, so assertions comparing
    // this id against server-returned data never mismatch on case alone.
    let selectedItemId = UUID().uuidString.lowercased()
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
      resource: MARKETPLACE_ITEMS_RESOURCE_ID,
      filter: ["id": selectedItemId],
      data: data
    )
    return (selectedItemId, selectedItemTitle)
  }

  static let rothschildDestinationAddress: [String: Any] = [
    "unit": "C509",
    "street": "28 Rothschild Avenue",
    "city": "Rosebery",
    "postcode": "2018",
    "state": "NSW",
    "country": "Australia",
    "latitude": -33.9172075,
    "longitude": 151.1985883,
  ]

  static let amazingFridgePickupAddressRow: [String: Any] = rothschildDestinationAddress.merging(
    [
      "id": "c81e85dd-f7fb-4310-8fc6-7c018aeaf82a",
      "instructions": "",
      "visibility": "private",
      "created_at": "2026-05-20T22:56:17.000Z",
      "updated_at": "2026-05-20T22:56:17.000Z",
    ]
  ) { _, new in new }

  static func settlingMessageData(
    time: String,
    destinationAddress: [String: Any]? = nil,
    pickupAddress: [String: Any]? = nil
  ) -> [String: Any] {
    var data: [String: Any] = [
      "time": time
    ]
    if let destinationAddress {
      data["destination_address"] = destinationAddress
    }
    if let pickupAddress {
      data["pickup_address"] = pickupAddress
    }
    return data
  }

  override func tearDownWithError() throws {
    app = nil
  }
}

// MARK: - Core UI (navigation, swipe-left, segments)

final class E2ECoreUITests: E2ETestBase {
  private static let swipeLeftDestPageId = "c7d6e5f4-a3b2-4c1d-8e0f-1a2b3c4d5e6f"
  private static let swipeLeftRowId = "d6e5f4a3-b2c1-4d0e-9f8a-7b6c5d4e3f2a"
  private static let coreHomePageId = "55e427ac-263c-441f-9673-f60627b1baea"

  override var homeFlowId: String? { E2EFlowIds.navigationHomeFlow }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try seedFlows(
      [
        (
          flowId: E2EFlowIds.navigationHomeFlow,
          flowData: Self.coreUITestsHomeFlowData(
            flowId: E2EFlowIds.navigationHomeFlow,
            homePageId: Self.coreHomePageId,
            destPageId: Self.swipeLeftDestPageId,
            swipeRowId: Self.swipeLeftRowId,
            viewFlowId: E2EFlowIds.navigationViewFlow,
            viewPageId: E2EFlowIds.navigationViewPage,
            createFlowId: E2EFlowIds.webSocketCreateFlow,
            createPageId: E2EFlowIds.webSocketCreatePage
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

  func testCoreUIBehaviors() throws {
    let homePage = app.scrollViews["page_\(Self.coreHomePageId)"]
    XCTAssertTrue(
      homePage.waitForExistence(timeout: 20),
      "Core UI home page should load - verify API is running and seeded")

    XCTContext.runActivity(named: "Navigation and visibility") { _ in
      let loadingIndicator = app.progressIndicators["loadingIndicator"]
      let initialUIAppeared =
        loadingIndicator.waitForExistence(timeout: 5) || homePage.waitForExistence(timeout: 5)
      XCTAssertTrue(
        initialUIAppeared || app.buttons.count > 0 || app.staticTexts.count > 0,
        "App should display initial UI after launch")

      let viewItemButton = app.buttons["View"]
      let createItemButton = app.buttons["Create"]
      XCTAssertTrue(viewItemButton.exists, "View button should be visible")
      XCTAssertTrue(createItemButton.exists, "Create button should be visible")

      viewItemButton.tap()
      let scrollView = app.scrollViews.firstMatch
      XCTAssertTrue(
        scrollView.waitForExistence(timeout: 10), "Page should appear after tapping View")
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
        viewItemButton.waitForExistence(timeout: 5),
        "Should return to home screen after create flow")
    }

    XCTContext.runActivity(named: "Swipe-left navigates to destination") { _ in
      let rowTitle = app.staticTexts["Swipe me"]
      XCTAssertTrue(
        rowTitle.waitForExistence(timeout: 10),
        "Swipeable text row should be visible")

      rowTitle.swipeLeft(velocity: .slow)

      let swipeButton = app.buttons["swipeLeft_\(Self.swipeLeftRowId)"]
      XCTAssertTrue(
        swipeButton.waitForExistence(timeout: 3),
        "Swipe-left action button should be revealed after swipe")
      XCTAssertEqual(swipeButton.label, "Open")
      swipeButton.tap()

      let destinationPage = app.scrollViews["page_\(Self.swipeLeftDestPageId)"]
      XCTAssertTrue(
        destinationPage.waitForExistence(timeout: 5),
        "Swipe-left action should navigate to the destination page")

      let backButton = app.navigationBars.buttons.firstMatch
      XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Back button should exist")
      backButton.tap()
      XCTAssertTrue(homePage.waitForExistence(timeout: 5), "Should return to home screen")
    }

    XCTContext.runActivity(named: "Segment switching swaps child content") { _ in
      let pickupContent = app.staticTexts["Pickup segment content"]
      let deliveryContent = app.staticTexts["Delivery segment content"]

      XCTAssertTrue(
        pickupContent.waitForExistence(timeout: 10),
        "First segment content should be visible on launch")
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
  }

  private static func coreUITestsHomeFlowData(
    flowId: String,
    homePageId: String,
    destPageId: String,
    swipeRowId: String,
    viewFlowId: String,
    viewPageId: String,
    createFlowId: String,
    createPageId: String
  ) -> [String: Any] {
    return [
      "id": flowId,
      "name": "E2E Core UI",
      "pages": [
        [
          "id": homePageId,
          "title": "Home",
          "rows": [
            [
              "id": "a74bc80e-ffda-4e19-b8f3-cd882405958b",
              "type": "vertical_container",
              "actions": [:],
              "visible": "true",
              "title": "",
              "children": [
                Self.buttonRow(
                  id: "441c1433-446b-4682-854d-5d795ef52709",
                  label: "View",
                  action: "{navigate(\(viewFlowId),\(viewPageId))}"
                ),
                Self.buttonRow(
                  id: "c1ad8812-a824-4ca2-bb27-5bc840ae7e08",
                  label: "Create",
                  action: "{navigate(\(createFlowId),\(createPageId))}"
                ),
              ],
            ],
            [
              "id": swipeRowId,
              "type": "text",
              "visible": "true",
              "title": "Swipe me",
              "subtitle": "",
              "swipe_label": "Open",
              "name": "Swipeable text",
              "actions": Self.actionsObject(
                swipeLeft: [
                  Self.rowAction(true: "{navigate(\(flowId),\(destPageId))}")
                ]
              ),
            ],
            [
              "id": "6a5b4c3d-2e1f-4a0b-8c9d-1e2f3a4b5c6d",
              "type": "tab_container",
              "actions": Self.actionsObject(
                tap: [Self.rowAction(true: "{select($datum)}")]
              ),
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
            ],
          ],
        ],
        [
          "id": destPageId,
          "title": "Destination",
          "rows": [
            Self.textRow(
              id: "e5f4a3b2-c1d0-4e9f-8a7b-6c5d4e3f2a1b",
              title: "Arrived"
            )
          ],
        ],
      ],
    ]
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

  private func seedIsolatedFlows() throws {
    try seedFlows(
      [
        (
          flowId: E2EFlowIds.webSocketHomeFlow,
          flowData: try createHomeFlowData(buttonLabel: "View")
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
  func testLiveSDUIUpdatesOnHomeFlow() throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    let host = apiHost
    try awaitResult("emitter setup") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
    }

    try XCTContext.runActivity(named: "Row update preserves unrelated input state") { _ in
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
      try awaitResult("push relabel SDUI") {
        try await emitter.updateSDUI(
          flowData: try self.createHomeFlowData(buttonLabel: updatedLabel),
          flowId: E2EFlowIds.webSocketHomeFlow
        )
      }

      let updatedButton = app.buttons[updatedLabel]
      XCTAssertTrue(
        updatedButton.waitForExistence(timeout: 10),
        "Button should update to '\(updatedLabel)' after notification")
      XCTAssertTrue(
        (inputField.value as? String)?.contains(typedText) == true,
        "Unrelated input should retain typed text after a row-only SDUI update, got: '\(inputField.value as? String ?? "nil")'"
      )
    }

    try XCTContext.runActivity(named: "Conditional action evaluates logical expression") { _ in
      let conditionalLabel = "Conditional \(Int(Date().timeIntervalSince1970))"
      try awaitResult("push conditional flow") {
        try await emitter.updateSDUI(
          flowData: try self.createConditionalFlowData(buttonLabel: conditionalLabel),
          flowId: E2EFlowIds.webSocketHomeFlow
        )
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
    }

    try awaitResult("disconnect") {
      await emitter.disconnect()
    }
  }

  @MainActor
  func testSheetPresentationAndReactivity() throws {
    let emitter = WSEmitter()
    let host = apiHost
    try awaitResult("emitter setup") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
    }

    let (selectedItemId, selectedItemTitle) = try awaitResult("create marketplace item") {
      try await self.createMarketplaceItem(
        emitter: emitter,
        titlePrefix: "Sheet presentation item"
      )
    }

    _ = try awaitResult("open view item page") {
      try await self.openViewItemPage(
        emitter: emitter,
        labelPrefix: "View sheet presentation",
        itemId: selectedItemId,
        viewFlowDataBuilder: Self.sheetPresentationAndReactivityFlowData
      )
    }

    XCTContext.runActivity(named: "Cross-page sheet from another page") { _ in
      let openCrossPageSheetButton = app.buttons["Open cross-page sheet"]
      XCTAssertTrue(
        openCrossPageSheetButton.waitForExistence(timeout: 10),
        "Cross-page sheet test page should show the Open cross-page sheet button")
      openCrossPageSheetButton.tap()

      XCTAssertTrue(
        app.staticTexts["Opened sheet row from another page"].waitForExistence(timeout: 10),
        "Show should present a sheet row that belongs to another page in the same flow")
      app.buttons["Done"].tap()
    }

    XCTContext.runActivity(named: "Sheet title updates when watched data changes") { _ in
      let openSheetButton = app.buttons["Open sheet"]
      XCTAssertTrue(
        openSheetButton.waitForExistence(timeout: 10),
        "Sheet title test page should show the Open sheet button")
      openSheetButton.tap()

      XCTAssertTrue(
        app.navigationBars.staticTexts[selectedItemTitle].waitForExistence(timeout: 10),
        "Sheet nav title should resolve {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} on open")

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

    try awaitResult("disconnect") {
      await emitter.disconnect()
    }
  }

  @MainActor
  func testViewItemTimeslotPickerRendersPickupAvailability() async throws {
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
  func testItemPageRequestsAndValidation() throws {
    let emitter = WSEmitter()
    let host = apiHost
    let selectedTimeslot = "2026-06-03T09:00:00"
    try awaitResult("emitter setup") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
    }
    let (selectedItemId, selectedItemTitle) = try awaitResult("create marketplace item") {
      try await self.createMarketplaceItem(
        emitter: emitter,
        titlePrefix: "Item page requests item",
        pickupSelection: [selectedTimeslot, "2026-06-03T10:00:00"],
        shippingFee: "5"
      )
    }

    _ = try awaitResult("open view item page") {
      try await self.openViewItemPage(
        emitter: emitter,
        labelPrefix: "Item page requests",
        itemId: selectedItemId,
        buttonExistenceMessage: "Request view button should load"
      )
    }
    try awaitResult("subscribe data_changed") {
      try await emitter.subscribe(event: "data_changed")
    }

    let heldPaymentCopy =
      "Your payment will be held on EVY until shipping has been confirmed (within 48 hours)."
    let noSurchargeCopy =
      "Shipping should be confirmed within 48 hours by the seller."

    XCTContext.runActivity(named: "Earlier-timeslot warning on later slot") { _ in
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
      XCTAssertTrue(
        app.staticTexts.containing(
          NSPredicate(format: "label CONTAINS %@", selectedItemTitle)
        ).firstMatch.waitForExistence(timeout: 5),
        "Confirmation sheet should mention the item title")
      XCTAssertFalse(
        earlierTimeslotWarning.waitForExistence(timeout: 2),
        "Earliest timeslot confirmation should not show the earlier-timeslot warning")
      dismissConfirmationSheet()
    }

    try XCTContext.runActivity(named: "Sheet dismiss writes no pickup message") { _ in
      let messagesAfterDismiss = try awaitResult("get messages after dismiss") {
        try await emitter.getResource(
          resource: EVYCoreResource.messages.ref
        )
      }
      XCTAssertFalse(
        Self.messagesContain(
          messagesAfterDismiss,
          type: "pickup",
          itemId: selectedItemId
        ),
        "Cancelling confirmation should not create a pickup request"
      )
    }

    try XCTContext.runActivity(named: "Empty postcode validation") { _ in
      let askToBuyButton = app.buttons["Ask to buy"]
      XCTAssertTrue(
        askToBuyButton.waitForExistence(timeout: 10), "Ask to buy button should be visible")
      askToBuyButton.tap()

      let missingInformationAlert = app.alerts["Missing information"]
      XCTAssertTrue(
        missingInformationAlert.waitForExistence(timeout: 5),
        "An empty shipping postcode should show the missing-information alert")
      let messagesAfterEmptyPostcode = try awaitResult("get messages after empty postcode") {
        try await emitter.getResource(
          resource: EVYCoreResource.messages.ref
        )
      }
      XCTAssertFalse(
        Self.messagesContain(
          messagesAfterEmptyPostcode,
          type: "shipping",
          itemId: selectedItemId
        ),
        "An empty postcode must not create a shipping request"
      )
      let dismissAlertButton = missingInformationAlert.buttons.firstMatch
      XCTAssertTrue(dismissAlertButton.exists, "Missing-information alert should be dismissible")
      dismissAlertButton.tap()
    }

    try XCTContext.runActivity(named: "Surcharge copy when fee > 0") { _ in
      try fillShippingPostcodeAndAskToBuy()

      XCTAssertTrue(
        waitForConfirmationSheet(timeout: 5),
        "Shipping confirmation sheet should appear after Ask to buy with a postcode")
      XCTAssertTrue(
        app.staticTexts.containing(
          NSPredicate(format: "label CONTAINS %@", heldPaymentCopy)
        ).firstMatch.waitForExistence(timeout: 5),
        "Surcharge item confirmation should show the held-payment notice")
      XCTAssertFalse(
        app.staticTexts.containing(
          NSPredicate(format: "label CONTAINS %@", noSurchargeCopy)
        ).firstMatch.waitForExistence(timeout: 2),
        "Surcharge item confirmation should not show the no-surcharge notice")
      dismissConfirmationSheet()
      XCTAssertTrue(
        waitForConfirmationSheetDismissed(timeout: 5),
        "Shipping confirmation sheet should dismiss without confirming")
    }

    try XCTContext.runActivity(named: "Pickup and shipping requests write messages") { _ in
      try fillShippingPostcodeAndAskToBuy()
      XCTAssertTrue(
        waitForConfirmationSheet(timeout: 5),
        "Shipping confirmation sheet should appear after Ask to buy with a postcode")
      tapConfirmationSheetRequestButton()

      let shippingRequestCreated = try awaitResult("wait for shipping message") {
        try await self.waitForMessage(
          emitter: emitter,
          type: "shipping",
          itemId: selectedItemId,
          valueKey: "postalcode",
          value: "2018"
        )
      }
      XCTAssertTrue(
        shippingRequestCreated,
        "Ask to buy should create a shipping request with the entered postcode")

      let earlierTimeslot = app.staticTexts["09:00"].firstMatch
      XCTAssertTrue(
        earlierTimeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
      earlierTimeslot.tap()
      XCTAssertTrue(
        waitForConfirmationSheet(timeout: 5),
        "Pickup confirmation sheet should appear after selecting a timeslot")
      tapConfirmationSheetRequestButton()
      XCTAssertFalse(
        app.alerts.firstMatch.waitForExistence(timeout: 2),
        "Pickup request should not show a native confirmation alert")

      let pickupRequestCreated = try awaitResult("wait for pickup message") {
        try await self.waitForMessage(
          emitter: emitter,
          type: "pickup",
          itemId: selectedItemId,
          valueKey: "time",
          value: selectedTimeslot
        )
      }
      XCTAssertTrue(
        pickupRequestCreated,
        "Tapping a pickup timeslot should create a matching marketplace message")
    }

    try awaitResult("disconnect") {
      await emitter.disconnect()
    }
  }

  @MainActor
  func testPickupRequestLifecycle() throws {
    let emitter = WSEmitter()
    let host = apiHost
    let selectedTimeslot = "2026-06-03T09:00:00"
    try awaitResult("emitter setup") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
    }
    let (selectedItemId, _) = try awaitResult("create marketplace item") {
      try await self.createMarketplaceItem(
        emitter: emitter,
        titlePrefix: "Pickup lifecycle item",
        pickupSelection: [selectedTimeslot]
      )
    }

    _ = try awaitResult("open view item page") {
      try await self.openViewItemPage(
        emitter: emitter,
        labelPrefix: "Pickup lifecycle",
        itemId: selectedItemId,
        viewFlowDataBuilder: Self.viewItemCancelRequestFlowData,
        buttonExistenceMessage: "Request view button should load"
      )
    }
    try awaitResult("subscribe data_changed") {
      try await emitter.subscribe(event: "data_changed")
    }

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    XCTAssertFalse(
      app.buttons["Cancel pickup request"].exists,
      "Cancel pickup request should be hidden before a request exists")

    try XCTContext.runActivity(named: "UI cancel restores picker") { _ in
      timeslot.tap()
      XCTAssertTrue(
        waitForConfirmationSheet(timeout: 5),
        "Pickup confirmation sheet should appear after selecting a timeslot")
      tapConfirmationSheetRequestButton()

      let pickupRequestCreated = try awaitResult("wait for pickup message") {
        try await self.waitForMessage(
          emitter: emitter,
          type: "pickup",
          itemId: selectedItemId,
          valueKey: "time",
          value: selectedTimeslot
        )
      }
      XCTAssertTrue(pickupRequestCreated, "Tapping a pickup timeslot should create a message")

      let cancelButton = app.buttons["Cancel pickup request"].firstMatch
      XCTAssertTrue(
        cancelButton.waitForExistence(timeout: 10),
        "Cancel pickup request should replace the transfer tabs and pickup timeslot")
      XCTAssertFalse(timeslot.exists, "Pickup timeslot should be hidden after creating a request")
      XCTAssertFalse(
        app.segmentedControls.buttons["Shipping"].waitForExistence(timeout: 2),
        "Transfer tabs collapse while an arrangement is in flight, leaving just that request")

      cancelButton.tap()
      XCTAssertTrue(
        waitForConfirmationSheet(timeout: 5),
        "Cancel pickup confirmation sheet should appear")
      let confirmCancelButton = try XCTUnwrap(
        waitForHittableButton(labeled: "Cancel request"),
        "Confirm cancel button should be tappable in the sheet")
      confirmCancelButton.tap()

      let requestWithdrawn = try awaitResult("wait for cancel message") {
        try await self.waitForMessage(
          emitter: emitter,
          itemId: selectedItemId,
          valueKey: "value",
          value: "cancel"
        )
      }
      XCTAssertTrue(
        requestWithdrawn, "Cancel request should append a cancel message, not rewrite the request")
      XCTAssertTrue(
        timeslot.waitForExistence(timeout: 10),
        "Pickup timeslot should return after cancelling the request")
    }

    try XCTContext.runActivity(named: "Server reject restores picker") { _ in
      timeslot.tap()
      XCTAssertTrue(
        waitForConfirmationSheet(timeout: 5),
        "Pickup confirmation sheet should appear after selecting a timeslot")
      tapConfirmationSheetRequestButton()

      XCTAssertTrue(
        waitForCancelRequestVisible(timeout: 10),
        "Cancel pickup request should be visible while the request is open")

      let requestId = try awaitResult("wait for pickup request id") {
        try await self.waitForMessageId(
          emitter: emitter,
          itemId: selectedItemId,
          type: "pickup",
          value: "pending",
          failureMessage: "An open pickup request should exist for the item"
        )
      }

      _ = try awaitResult("reject pickup request") {
        try await emitter.createResource(
          resource: EVYCoreResource.messages.ref,
          data: [
            "fk": selectedItemId,
            "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
            "visibility": "private",
            "parent_message_id": requestId,
            "type": "pickup",
            "value": "reject",
            "data": Self.settlingMessageData(
              time: selectedTimeslot
            ),
          ]
        )
      }
      _ = try awaitResult("wait for reject response") {
        try await self.waitForMessageResponse(
          emitter: emitter,
          messageId: requestId,
          value: "reject"
        )
      }

      XCTAssertTrue(
        waitForCancelRequestHidden(timeout: 10),
        "Cancel pickup request should go once the request has been answered")
      XCTAssertTrue(
        timeslot.waitForExistence(timeout: 10),
        "Pickup timeslots should return after a rejection")
      XCTAssertFalse(
        app.staticTexts.matching(
          NSPredicate(format: "label BEGINSWITH %@", "Pickup confirmed for")
        ).firstMatch.exists,
        "A rejection is not a confirmation")
    }

    try XCTContext.runActivity(named: "Server accept shows confirmation") { _ in
      timeslot.tap()
      XCTAssertTrue(
        waitForConfirmationSheet(timeout: 5),
        "Pickup confirmation sheet should appear after selecting a timeslot")
      tapConfirmationSheetRequestButton()

      let pickupRequestCreated = try awaitResult("wait for pickup message") {
        try await self.waitForMessage(
          emitter: emitter,
          type: "pickup",
          itemId: selectedItemId,
          valueKey: "time",
          value: selectedTimeslot
        )
      }
      XCTAssertTrue(pickupRequestCreated, "Tapping a pickup timeslot should create a message")
      XCTAssertTrue(
        waitForCancelRequestVisible(timeout: 10),
        "Cancel pickup request should be visible for a pending request")

      let messageId = try awaitResult("wait for pickup message id") {
        try await self.waitForMessageId(
          emitter: emitter,
          itemId: selectedItemId,
          type: "pickup",
          value: "pending",
          failureMessage: "Created pickup message should be readable from the API"
        )
      }

      _ = try awaitResult("accept pickup request") {
        try await emitter.createResource(
          resource: EVYCoreResource.messages.ref,
          data: [
            "fk": selectedItemId,
            "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
            "visibility": "private",
            "parent_message_id": messageId,
            "type": "pickup",
            "value": "accept",
            "data": Self.settlingMessageData(
              time: selectedTimeslot,
              pickupAddress: Self.amazingFridgePickupAddressRow
            ),
          ]
        )
      }
      _ = try awaitResult("wait for accept response") {
        try await self.waitForMessageResponse(
          emitter: emitter,
          messageId: messageId,
          value: "accept"
        )
      }

      XCTAssertTrue(
        waitForCancelRequestHidden(timeout: 10),
        "Cancel pickup request should hide once the request is answered")
      XCTAssertTrue(
        app.staticTexts.matching(
          NSPredicate(format: "label BEGINSWITH %@", "Pickup confirmed for")
        ).firstMatch.waitForExistence(timeout: 10),
        "Pickup segment should show the accepted confirmation row")
      XCTAssertTrue(
        app.staticTexts["C509 28 Rothschild Avenue, 2018 Rosebery NSW"].waitForExistence(
          timeout: 10),
        "Accepted pickup should show the full address carried by the accept message")
      XCTAssertFalse(
        app.segmentedControls.buttons["Shipping"].waitForExistence(timeout: 2),
        "Transfer tabs stay collapsed once an arrangement is agreed")
      let shippingConfirmation = app.staticTexts.matching(
        NSPredicate(format: "label BEGINSWITH %@", "Shipping confirmed")
      ).firstMatch
      XCTAssertFalse(
        shippingConfirmation.waitForExistence(timeout: 2),
        "Shipping confirmation should stay hidden for an accepted pickup request")
    }

    try awaitResult("disconnect") {
      await emitter.disconnect()
    }
  }

  /// The id of a message for an item, as the server holds it.
  @MainActor
  private func waitForMessageId(
    emitter: WSEmitter,
    itemId: String,
    type: String = "pickup",
    value: String? = "pending",
    failureMessage: String,
    timeout: TimeInterval = 10
  ) async throws -> String {
    let deadline = Date().addingTimeInterval(timeout)
    repeat {
      let payload = try await emitter.getResource(
        resource: EVYCoreResource.messages.ref
      )
      if let rows = Self.responseDataArray(from: payload) {
        // Prefer the newest match: lifecycle merges reuse one item across cancel/reject
        // cycles, so older pending rows can still exist alongside a fresh request.
        let matches = rows.compactMap { $0 as? [String: Any] }.filter { row in
          guard row["fk"] as? String == itemId,
            row["type"] as? String == type
          else { return false }
          if let value {
            return row["value"] as? String == value
          }
          return true
        }
        if let match = matches.max(by: { lhs, rhs in
          (lhs["created_at"] as? String ?? "") < (rhs["created_at"] as? String ?? "")
        }),
          let id = match["id"] as? String
        {
          return id
        }
      }
    } while try await emitter.nextDataChanged(
      resource: EVYCoreResource.messages.ref, deadline: deadline)
    XCTFail(failureMessage)
    return ""
  }

  @MainActor
  func testSenderIsOfferedCancelAndCannotAnswerItsOwnRequest() throws {
    let emitter = WSEmitter()
    let host = apiHost
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (itemId, _) = try awaitResult("create sender cancel item") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
      return try await self.createMarketplaceItem(
        emitter: emitter,
        titlePrefix: "Sender cancel item",
        pickupSelection: [selectedTimeslot]
      )
    }

    let viewLabel = "Sender cancel \(Int(Date().timeIntervalSince1970))"
    let homeFlowData = try createHomeFlowData(
      buttonLabel: viewLabel,
      viewItemId: itemId,
      includeHomeInbox: true
    )
    let senderFlowData = E2ETestBase.senderViewFlowData(
      flowId: E2EFlowIds.webSocketViewFlow,
      pageId: E2EFlowIds.webSocketViewPage
    )
    try awaitResult("seed sender inbox flow") {
      try await emitter.updateSDUI(
        flowData: homeFlowData,
        flowId: E2EFlowIds.webSocketHomeFlow
      )
      try await emitter.updateSDUI(
        flowData: senderFlowData,
        flowId: E2EFlowIds.webSocketViewFlow
      )
      try await emitter.subscribe(event: "data_changed")
    }

    app.terminate()
    try launchApp()
    let viewButton = app.buttons[viewLabel]
    XCTAssertTrue(
      viewButton.waitForExistence(timeout: 20),
      "Sender request view button should load")
    XCTAssertTrue(
      scrollUntilHittable(viewButton),
      "Sender request view button should be reachable")
    viewButton.tap()

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 15), "Pickup timeslot should be visible")
    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    tapConfirmationSheetRequestButton()

    let requestId = try awaitResult("wait for sender request") {
      try await self.waitForMessageId(
        emitter: emitter,
        itemId: itemId,
        type: "pickup",
        value: nil,
        failureMessage: "Tapping a pickup timeslot should have created a request"
      )
    }
    let backButton = app.navigationBars.buttons.firstMatch
    XCTAssertTrue(
      backButton.waitForExistence(timeout: 5), "The request page should have a back button")
    backButton.tap()

    let fromYouTab = app.segmentedControls.buttons["From you"]
    XCTAssertTrue(
      fromYouTab.waitForExistence(timeout: 10),
      "The inbox should include a From you tab")
    XCTAssertTrue(
      scrollUntilHittable(fromYouTab),
      "The From you tab should be reachable below the request picker")
    fromYouTab.tap()

    let childRowId = E2ETestBase.homeInboxFromYouChildRowId
    let row = app.otherElements["swipeRow_\(childRowId)_\(requestId)"]
    XCTAssertTrue(
      row.waitForExistence(timeout: 10),
      "The request created by this device should appear under From you")
    XCTAssertTrue(
      scrollUntilHittable(row),
      "The request row should be reachable after scrolling")
    row.swipeLeft(velocity: .slow)

    let swipeButtonId = "swipeLeft_\(childRowId)_\(requestId)"
    let swipeButton = app.buttons[swipeButtonId]
    XCTAssertTrue(
      swipeButton.waitForExistence(timeout: 3),
      "The sender should be offered cancel")
    XCTAssertEqual(swipeButton.label, "Cancel")
    XCTAssertEqual(
      app.buttons.matching(identifier: swipeButtonId).count,
      1,
      "The From you row should reveal exactly one declarative action")

    XCTAssertTrue(
      swipeButton.isHittable,
      "The revealed Cancel action should accept taps"
    )
    swipeButton.tap()
    XCTAssertTrue(
      // Generous: the row leaves in well under a second when the machine is
      // idle, but a loaded run (full e2e suite) has been seen to exceed 5s.
      row.waitForNonExistence(timeout: 15),
      "Cancel should optimistically remove the request from From you"
    )

    let cancelled = try awaitResult("wait for cancel response") {
      try await self.waitForMessageResponse(
        emitter: emitter,
        messageId: requestId,
        value: "cancel"
      )
    }
    XCTAssertTrue(cancelled, "Cancel should persist a response naming the request")
    try awaitResult("disconnect sender emitter") { await emitter.disconnect() }
  }

  @MainActor
  func testShippingZeroFeeConfirmationCopy() async throws {
    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let heldPaymentCopy =
      "Your payment will be held on EVY until shipping has been confirmed (within 48 hours)."
    let noSurchargeCopy =
      "Shipping should be confirmed within 48 hours by the seller."

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
  func testViewItemPageRendersNavigateQueryItem() async throws {
    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let (selectedItemId, selectedItemTitle) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Navigate query item",
      paymentMethods: ["cash": true, "app": false]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "View navigate query",
      itemId: selectedItemId,
      viewFlowDataBuilder: Self.viewItemFlowData,
      buttonExistenceMessage: "Home view button should load with query-aware label after relaunch"
    )

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

    XCTAssertTrue(
      app.staticTexts["Cash accepted"].waitForExistence(timeout: 10),
      "Cash payment row should be visible when \(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.cash is true"
    )
    XCTAssertFalse(
      app.staticTexts["App payments accepted"].waitForExistence(timeout: 2),
      "App payment row should be hidden when \(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.app is false"
    )

    let editedTitle = "Edited \(Int(Date().timeIntervalSince1970))"
    clearAndType(field: titleField, text: editedTitle, placeholder: "Enter a title")
    XCTAssertTrue(
      app.navigationBars.staticTexts[editedTitle].waitForExistence(timeout: 10),
      "Page nav title should update when {\(MARKETPLACE_ITEMS_RESOURCE_ID).title} is edited"
    )

    await emitter.disconnect()
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
    try awaitResult("emitter setup") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
    }
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
          "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).price: {value: $datum, currency: \"AUD\"}}"
        ],
        containsAny: ["\(MARKETPLACE_ITEMS_RESOURCE_ID).price"],
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
        resource: MARKETPLACE_ITEMS_RESOURCE_ID)
    }
    XCTAssertTrue(
      Self.marketplaceItemsContainListing(
        title: testTitle, priceValue: 99, widthText: "50", items: itemsPayload),
      "Marketplace items should include listing with title, price.value 99, and width 50"
    )

    try awaitResult("emitter disconnect") { await emitter.disconnect() }
  }

  @MainActor
  func testCreateItemRealFlowSearchSelectPersistsAddressAndLinksItem() throws {
    try seedFlows([
      (
        flowId: E2EFlowIds.defaultHomeFlow,
        flowData: try Self.productionHomeFlowData()
      )
    ])
    app.terminate()
    app = XCUIApplication()
    app.launchEnvironment["API_HOST"] = apiHost
    app.launchEnvironment["HOME_FLOW_ID"] = E2EFlowIds.defaultHomeFlow
    app.launch()

    let sellButton = app.buttons["Sell something"]
    XCTAssertTrue(
      sellButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded with real flows")
    sellButton.tap()

    let titleFieldId = "textField_{\(MARKETPLACE_ITEMS_RESOURCE_ID).title}"
    let titleInput = try XCTUnwrap(findElement(identifier: titleFieldId), "Title field")
    let titleField = try XCTUnwrap(tapAndGetEditableField(container: titleInput), "Editable title")
    let testTitle = "Real Create Flow \(Int(Date().timeIntervalSince1970))"
    clearAndType(field: titleField, text: testTitle, placeholder: "My iPhone")
    dismissKeyboard()

    var nextButton = app.buttons["Next"]
    XCTAssertTrue(nextButton.waitForExistence(timeout: 10), "Next on create listing page")
    nextButton.tap()

    nextButton = app.buttons["Next"]
    XCTAssertTrue(nextButton.waitForExistence(timeout: 10), "Next on describe item page")
    nextButton.tap()

    let whereLabel = app.staticTexts["Where"]
    XCTAssertTrue(whereLabel.waitForExistence(timeout: 15), "Pickup Where row on fulfillment page")
    whereLabel.tap()

    let searchField = app.textFields.firstMatch
    XCTAssertTrue(searchField.waitForExistence(timeout: 5), "Search field in address sheet")
    clearAndType(field: searchField, text: "Sydney")

    let result = app.staticTexts.matching(
      NSPredicate(
        format: "label CONTAINS[c] %@ AND label != %@",
        "Sydney",
        "Where"
      )
    ).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 20), "Place search should return Sydney results")
    result.tap()
    XCTAssertFalse(searchField.waitForExistence(timeout: 2), "Address sheet should dismiss")

    for _ in 0..<4 {
      pageScrollView.swipeUp()
    }
    let timeslotButton = app.buttons.matching(
      NSPredicate(format: "label MATCHES %@", "^[0-9]{1,2}:[0-9]{2}$")
    ).firstMatch
    let timeslotText = app.staticTexts.matching(
      NSPredicate(format: "label MATCHES %@", "^[0-9]{1,2}:[0-9]{2}$")
    ).firstMatch
    let timeslot: XCUIElement
    if timeslotButton.waitForExistence(timeout: 5) {
      timeslot = timeslotButton
    } else {
      timeslot = timeslotText
    }
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup availability timeslot")
    timeslot.tap()

    nextButton = app.buttons["Next"]
    XCTAssertTrue(nextButton.waitForExistence(timeout: 10), "Next on pickup and delivery page")
    nextButton.tap()

    XCTAssertTrue(
      app.staticTexts["Payment options"].waitForExistence(timeout: 10)
        || app.navigationBars["Payment options"].waitForExistence(timeout: 2),
      "Should reach payment options page")

    let cashOption = app.staticTexts.matching(
      NSPredicate(format: "label CONTAINS[c] %@", "cash on pickup")
    ).firstMatch
    if cashOption.waitForExistence(timeout: 5) {
      cashOption.tap()
    } else {
      let acceptCash = app.staticTexts["Accept cash"]
      XCTAssertTrue(acceptCash.waitForExistence(timeout: 5), "Accept cash payment option")
      acceptCash.tap()
    }

    let submitButton = app.buttons["Submit"]
    XCTAssertTrue(submitButton.waitForExistence(timeout: 10), "Submit on payment options page")
    submitButton.tap()
    XCTAssertTrue(waitForConfirmationSheet(timeout: 10), "Submit confirmation sheet should appear")
    let submitConfirmButton = try XCTUnwrap(
      waitForHittableButton(labeled: "Submit"),
      "Submit button in confirmation sheet should be tappable")
    submitConfirmButton.tap()

    XCTAssertTrue(
      sellButton.waitForExistence(timeout: 20),
      "Should return to home after creating listing with linked pickup address")

    let emitter = WSEmitter()
    let host = apiHost
    try awaitResult("emitter setup") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
    }

    let itemMatched = try awaitResult("wait for marketplace item with address_id") {
      try await self.waitForResourceUpdate(
        emitter: emitter, resource: MARKETPLACE_ITEMS_RESOURCE_ID,
        timeout: 20
      ) { payload in
        Self.marketplaceItemsContainListingWithAddressId(title: testTitle, items: payload)
      }
    }

    let itemsPayload = try awaitResult("fetch marketplace items") {
      try await emitter.getResource(
        resource: MARKETPLACE_ITEMS_RESOURCE_ID)
    }
    if !itemMatched {
      Self.failWithItemsSummary(
        title: testTitle,
        items: itemsPayload,
        message: "Created item should have transfer_options.pickup.address_id.")
      try awaitResult("emitter disconnect") { await emitter.disconnect() }
      return
    }
    guard let addressId = Self.marketplaceItemPickupAddressId(title: testTitle, items: itemsPayload)
    else {
      XCTFail("Expected pickup address_id on created listing")
      try awaitResult("emitter disconnect") { await emitter.disconnect() }
      return
    }

    let addressesPayload = try awaitResult("fetch core address row") {
      try await emitter.getResource(
        resource: EVYCoreResource.addresses.ref,
        filter: ["id": addressId]
      )
    }
    XCTAssertTrue(
      Self.coreAddressesContainId(addressId, addresses: addressesPayload),
      "Core addresses should contain the linked pickup address id \(addressId)"
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

  @MainActor
  private func waitForCancelRequestVisible(timeout: TimeInterval) -> Bool {
    let labels = ["pickup", "delivery", "shipping"].map { Self.cancelRequestButtonLabel(type: $0) }
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if labels.contains(where: { app.buttons[$0].exists }) {
        return true
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
    return labels.contains { app.buttons[$0].exists }
  }

  @MainActor
  private func waitForCancelRequestHidden(timeout: TimeInterval) -> Bool {
    let labels = ["pickup", "delivery", "shipping"].map { Self.cancelRequestButtonLabel(type: $0) }
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if labels.allSatisfy({ !app.buttons[$0].exists }) {
        return true
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
    return labels.allSatisfy { !app.buttons[$0].exists }
  }

  private func waitForMessage(
    emitter: WSEmitter,
    type: String? = nil,
    itemId: String,
    valueKey: String? = nil,
    value: String? = nil
  ) async throws -> Bool {
    try await waitForResourceUpdate(
      emitter: emitter, resource: EVYCoreResource.messages.ref
    ) {
      Self.messagesContain(
        $0,
        type: type,
        itemId: itemId,
        valueKey: valueKey,
        value: value
      )
    }
  }

  private static func messagesContain(
    _ messages: Any,
    type: String? = nil,
    itemId: String,
    valueKey: String? = nil,
    value: String? = nil
  ) -> Bool {
    guard let messageRows = responseDataArray(from: messages) else { return false }
    return messageRows.contains { message in
      guard let messageData = message as? [String: Any],
        messageData["fk"] as? String == itemId
      else {
        return false
      }
      if let type, messageData["type"] as? String != type {
        return false
      }
      guard let valueKey, let value else { return true }
      if valueKey == "value" {
        return messageData[valueKey] as? String == value
      }
      let messageDetails = messageData["data"] as? [String: Any]
      return messageDetails?[valueKey] as? String == value
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

  fileprivate static func marketplaceItemsContainListingWithAddressId(
    title: String,
    items: Any
  ) -> Bool {
    marketplaceItemPickupAddressId(title: title, items: items) != nil
  }

  fileprivate static func itemMatchesTitle(_ item: [String: Any], title: String) -> Bool {
    let needle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    let topTitle = (item["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let nestedTitle = (item[MARKETPLACE_ITEMS_RESOURCE_ID] as? [String: Any])?["title"] as? String
    let nestedNormalized = nestedTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
    return topTitle == needle || nestedNormalized == needle
  }

  fileprivate static func marketplaceItemsMatchingTitleSummary(title: String, items: Any) -> String
  {
    guard let itemsArray = responseDataArray(from: items) else {
      return "No items array in payload: \(String(describing: items).prefix(400))"
    }
    let needle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    let matches = itemsArray.compactMap { entry -> [String: Any]? in
      guard let item = entry as? [String: Any], itemMatchesTitle(item, title: needle) else {
        return nil
      }
      return item
    }
    if matches.isEmpty {
      return "No item titled \(needle) among \(itemsArray.count) marketplace items"
    }
    return "Matching item(s): \(String(describing: matches).prefix(800))"
  }

  fileprivate static func failWithItemsSummary(
    title: String,
    items: Any,
    message: String
  ) {
    let summary = marketplaceItemsMatchingTitleSummary(title: title, items: items)
    XCTFail("\(message) \(summary)")
  }

  fileprivate static func marketplaceItemPickupAddressId(title: String, items: Any) -> String? {
    guard let itemsArray = responseDataArray(from: items) else { return nil }
    let normalizedExpectedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    for case let item as [String: Any] in itemsArray {
      guard itemMatchesTitle(item, title: normalizedExpectedTitle) else { continue }
      if item[MARKETPLACE_ITEMS_RESOURCE_ID] != nil { return nil }
      guard let transfer = item["transfer_options"] as? [String: Any],
        let pickup = transfer["pickup"] as? [String: Any],
        let addressId = pickup["address_id"] as? String,
        !addressId.isEmpty
      else {
        return nil
      }
      if item["pickup_address"] != nil { return nil }
      return addressId
    }
    return nil
  }

  fileprivate static func coreAddressesContainId(_ addressId: String, addresses: Any) -> Bool {
    let normalizedId = addressId.lowercased()
    func recordMatches(_ record: [String: Any]) -> Bool {
      guard let id = record["id"] as? String else { return false }
      return id.lowercased() == normalizedId
    }
    if let itemsArray = responseDataArray(from: addresses) {
      return itemsArray.contains { entry in
        guard let record = entry as? [String: Any] else { return false }
        return recordMatches(record)
      }
    }
    if let record = addresses as? [String: Any] {
      if recordMatches(record) {
        return true
      }
      if let data = record["data"] as? [String: Any], recordMatches(data) {
        return true
      }
    }
    return false
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
      flowData: try createHomeFlowData(buttonLabel: viewLabel, viewItemId: itemId),
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
    includeHomeInbox: Bool = false
  ) throws -> [String: Any] {
    let viewAction = Self.viewItemNavigateAction(viewItemId: viewItemId)

    let children: [[String: Any]] = [
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
    ]

    var homeRows: [[String: Any]] = [
      [
        "id": "a74bc80e-ffda-4e19-b8f3-cd882405958b",
        "type": "vertical_container",
        "actions": [:],
        "visible": "true",
        "title": "",
        "children": children,
      ]
    ]
    if includeHomeInbox {
      homeRows.insert(try Self.homeInboxTabRow(), at: 0)
    }

    return [
      "id": E2EFlowIds.webSocketHomeFlow,
      "name": "Home",
      "pages": [
        [
          "id": E2EFlowIds.webSocketHomePage,
          "title": "Home",
          "rows": homeRows,
        ]
      ],
    ]
  }

  private func createConditionalFlowData(buttonLabel: String) throws -> [String: Any] {
    var flowData = try createHomeFlowData(buttonLabel: buttonLabel)
    guard var pages = flowData["pages"] as? [[String: Any]],
      var homePage = pages.first,
      var rows = homePage["rows"] as? [[String: Any]],
      var firstRow = rows.first,
      var children = firstRow["children"] as? [[String: Any]],
      let buttonIndex = children.firstIndex(where: { ($0["label"] as? String) == buttonLabel }),
      let actionsObject = children[buttonIndex]["actions"] as? [String: Any],
      var actions = actionsObject["tap"] as? [[String: Any]],
      var firstAction = actions.first
    else {
      return flowData
    }

    var button = children[buttonIndex]
    firstAction["condition"] = "{1 > 0 || (0 > 1 && 2 > 3)}"
    actions[0] = firstAction
    button["actions"] = ["tap": actions]
    children[buttonIndex] = button
    firstRow["children"] = children
    rows[0] = firstRow
    homePage["rows"] = rows
    pages[0] = homePage
    flowData["pages"] = pages
    return flowData
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

// MARK: - Home inbox

final class E2EHomeInboxTests: E2ETestBase {
  private static let homePageId = E2EFlowIds.webSocketHomePage
  private static let seededMessageItemId = "12401f50-cf1a-45d7-a112-2e68a2070466"
  private static let seededBuyerItemId = "760eac03-8783-4916-846e-6c316d0af5a1"
  private static let seededPickupAddressId = "c81e85dd-f7fb-4310-8fc6-7c018aeaf82a"

  // Items whose status this class drives are minted per test case: the suite is
  // seeded once for the whole run, so a shared id would collide on create and
  // inherit the previous test's status history.
  private let shippingOwnedItemId = UUID().uuidString.lowercased()
  private let pickupOwnedItemId = UUID().uuidString.lowercased()
  // One per request seeded by `seedOwnRequest` — see that method for why.
  private let ownedRequestItemIds = (0..<3).map { _ in UUID().uuidString.lowercased() }
  private static let deliveryTimeslot = "2026-06-03T15:00:00"
  private static let pickupTimeslot = "2026-06-03T09:00:00"
  private static let shippingPostcode = "2018"

  override var homeFlowId: String? { E2EFlowIds.defaultHomeFlow }

  override var ownedResources: [OwnedResourceDeclaration] {
    [
      (
        resource: MARKETPLACE_ITEMS_RESOURCE_ID,
        ids: [Self.seededMessageItemId, shippingOwnedItemId, pickupOwnedItemId]
          + ownedRequestItemIds
      ),
      (
        resource: EVYCoreResource.addresses.ref,
        ids: [Self.seededPickupAddressId]
      ),
    ]
  }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try seedFlows([
      (flowId: E2EFlowIds.defaultHomeFlow, flowData: try Self.productionHomeFlowData())
    ])
    try runAsyncOperation("Seed owned marketplace items") { [self] in
      let emitter = WSEmitter()
      try await emitter.connect(host: self.apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      // The request items reuse the seeded item's title and pickup address so
      // the inbox assertions stay the same as when they shared that fixture.
      let items =
        [
          (self.shippingOwnedItemId, "E2E Shipping Item"),
          (self.pickupOwnedItemId, "E2E Pickup Item"),
        ] + self.ownedRequestItemIds.map { ($0, "Amazing Fridge") }
      for (itemId, title) in items {
        _ = try await emitter.createResource(
          resource: MARKETPLACE_ITEMS_RESOURCE_ID,
          filter: ["id": itemId],
          data: [
            "id": itemId,
            "title": title,
            "price": ["currency": "AUD", "value": 100],
            "pickup_selection": [Self.pickupTimeslot],
            "delivery_selection": [Self.deliveryTimeslot],
            "payment_methods": ["cash": true, "app": true],
            "transfer_options": [
              "pickup": [
                "selection": [Self.pickupTimeslot],
                "lead_time_hours": "24",
                "address_id": Self.seededPickupAddressId,
              ],
              "delivery": ["selection": [Self.deliveryTimeslot], "fee": [:]],
              "ship": ["postal_code": "", "areas": []],
            ],
          ]
        )
      }
      await emitter.disconnect()
    }
    try launchApp()
  }

  @MainActor
  func testRecipientRespondsToRequests() throws {
    let homePage = app.scrollViews["page_\(Self.homePageId)"]
    XCTAssertTrue(
      homePage.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try awaitResult("connect emitter") {
      try await emitter.connect(host: self.apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      try await emitter.subscribe(event: "data_changed")
    }

    try XCTContext.runActivity(named: "Reject via tap and sheet") { _ in
      let (requestId, _) = try seedOwnRequest(
        emitter: emitter, itemId: ownedRequestItemIds[0])
      let row = ownRequestRow(requestId: requestId)
      XCTAssertTrue(
        row.waitForExistence(timeout: 15),
        "A request for the owned item should appear under For you")
      XCTAssertTrue(scrollUntilHittable(row), "The request row should be reachable")
      row.tap()

      let sheetCopy = app.staticTexts["Accept this request, or reject it?"]
      XCTAssertTrue(
        sheetCopy.waitForExistence(timeout: 5),
        "Tapping the request should open its response sheet")
      let rejectButton = try XCTUnwrap(
        waitForHittableButton(labeled: "Reject"),
        "The response sheet should offer Reject"
      )
      rejectButton.tap()

      _ = try assertResponsePersisted(
        emitter: emitter,
        requestId: requestId,
        value: "reject",
        verifyRequestStillPending: true
      )
      XCTAssertTrue(
        sheetCopy.waitForNonExistence(timeout: 5),
        "Reject should dismiss the response sheet")
      XCTAssertTrue(
        row.waitForNonExistence(timeout: 10),
        "A rejected request should leave For you")
    }

    try XCTContext.runActivity(named: "Accept via swipe action") { _ in
      let (requestId, _) = try seedOwnRequest(
        emitter: emitter, itemId: ownedRequestItemIds[1])
      let row = ownRequestRow(requestId: requestId)
      XCTAssertTrue(
        row.waitForExistence(timeout: 15),
        "A request for the owned item should appear under For you")
      XCTAssertTrue(
        row.staticTexts["Amazing Fridge"].waitForExistence(timeout: 5),
        "The request row should show the addressed item title")
      XCTAssertTrue(
        row.staticTexts["pending"].waitForExistence(timeout: 5),
        "The request row should show its pending state")

      row.swipeLeft(velocity: .slow)
      let swipeButtonId =
        "swipeLeft_\(E2ETestBase.homeInboxForYouChildRowId)_\(requestId)"
      let swipeButton = app.buttons[swipeButtonId]
      XCTAssertTrue(
        swipeButton.waitForExistence(timeout: 3),
        "The recipient should be offered Accept")
      XCTAssertEqual(swipeButton.label, "Accept")
      XCTAssertEqual(
        app.buttons.matching(identifier: swipeButtonId).count,
        1,
        "The For you row should reveal exactly one declarative action")

      swipeButton.tap()
      let responseId = try assertResponsePersisted(
        emitter: emitter,
        requestId: requestId,
        value: "accept",
        verifyRequestStillPending: false
      )
      let pickupStreet = try readPickupStreetFromMessage(
        emitter: emitter,
        messageId: responseId
      )
      XCTAssertEqual(pickupStreet, "28 Rothschild Avenue")

      XCTAssertTrue(
        row.waitForNonExistence(timeout: 10),
        "An accepted request should leave For you")
      XCTAssertFalse(
        swipeButton.exists,
        "An answered request should no longer offer an action")

      app.segmentedControls.buttons["Scheduled"].tap()
      XCTAssertTrue(
        app.staticTexts["Amazing Fridge"].waitForExistence(timeout: 10),
        "The accepted request should appear under Scheduled")
      XCTAssertTrue(
        app.staticTexts["accept"].exists,
        "The Scheduled row should show the accepted state")
    }

    try XCTContext.runActivity(named: "Pre-answered request offers nothing in For you") { _ in
      let (requestId, _) = try seedOwnRequest(
        emitter: emitter, itemId: ownedRequestItemIds[2], responseValue: "accept")

      app.segmentedControls.buttons["Scheduled"].tap()
      XCTAssertTrue(
        app.staticTexts["Amazing Fridge"].waitForExistence(timeout: 15),
        "The pre-answered request should reach Scheduled")
      XCTAssertTrue(app.staticTexts["accept"].exists)

      app.segmentedControls.buttons["For you"].tap()
      let requestRow = ownRequestRow(requestId: requestId)
      XCTAssertFalse(
        requestRow.waitForExistence(timeout: 3),
        "An answered request should not remain under For you")
      XCTAssertFalse(
        app.buttons[
          "swipeLeft_\(E2ETestBase.homeInboxForYouChildRowId)_\(requestId)"
        ].exists,
        "An answered request should offer no swipe action")
    }

    try awaitResult("disconnect emitter") { await emitter.disconnect() }
  }

  @MainActor
  func testPurchaseConfirmationFlows() throws {
    let homePage = app.scrollViews["page_\(Self.homePageId)"]
    XCTAssertTrue(
      homePage.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try awaitResult("connect emitter") {
      try await emitter.connect(host: self.apiHost)
      try await emitter.login(token: "e2e-test", os: "ios")
      try await emitter.subscribe(event: "data_changed")
    }

    var deliveryPendingId = ""

    try XCTContext.runActivity(named: "Seller ships after charge") { _ in
      let (pendingId, acceptId) = try seedAcceptedRequest(
        emitter: emitter,
        itemId: shippingOwnedItemId,
        type: "shipping",
        timeslot: Self.pickupTimeslot,
        destinationAddress: Self.rothschildDestinationAddress
      )
      try runPaymentCapture(
        emitter: emitter,
        itemId: shippingOwnedItemId,
        authorizationMessageId: pendingId
      )
      try pollItemStatus(
        emitter: emitter, itemId: shippingOwnedItemId, expectedStatus: "sold")
      _ = try confirmViaSwipe(
        tab: "Scheduled",
        childRowId: E2ETestBase.homeInboxScheduledSellerShippingChildRowId,
        messageId: acceptId,
        swipeLabel: "Shipped",
        sheetTitle: "Confirm you shipped the item?",
        emitter: emitter,
        requestId: acceptId,
        responseValue: "sent"
      )
    }

    try XCTContext.runActivity(named: "Buyer receives delivery after given") { _ in
      let (pendingId, _) = try seedAcceptedRequest(
        emitter: emitter,
        itemId: Self.seededBuyerItemId,
        type: "delivery",
        timeslot: Self.deliveryTimeslot,
        destinationAddress: Self.rothschildDestinationAddress
      )
      deliveryPendingId = pendingId
      try runPaymentCapture(
        emitter: emitter,
        itemId: Self.seededBuyerItemId,
        authorizationMessageId: pendingId
      )
      try pollItemStatus(
        emitter: emitter, itemId: Self.seededBuyerItemId, expectedStatus: "sold")
      let givenId = try seedPurchaseMessage(
        emitter: emitter,
        itemId: Self.seededBuyerItemId,
        type: "delivery",
        value: "given",
        parentMessageId: pendingId,
        data: Self.settlingMessageData(time: Self.deliveryTimeslot)
      )
      _ = try confirmViaSwipe(
        tab: "Scheduled",
        childRowId: E2ETestBase.homeInboxScheduledBuyerDeliveryChildRowId,
        messageId: givenId,
        swipeLabel: "Received",
        sheetTitle: "Confirm you received the item?",
        emitter: emitter,
        requestId: givenId,
        responseValue: "received"
      )
    }

    try XCTContext.runActivity(named: "Pickup handshake confirms exchange") { _ in
      let (pendingId, _) = try seedAcceptedRequest(
        emitter: emitter,
        itemId: pickupOwnedItemId,
        type: "pickup",
        timeslot: Self.pickupTimeslot,
        pickupAddress: Self.amazingFridgePickupAddressRow
      )
      let transactionId = try seedPurchaseMessage(
        emitter: emitter,
        itemId: pickupOwnedItemId,
        type: "pickup",
        value: "transaction",
        parentMessageId: pendingId,
        data: Self.settlingMessageData(time: Self.pickupTimeslot)
      )
      _ = try confirmViaSwipe(
        tab: "For you",
        childRowId: E2ETestBase.homeInboxPickupHandshakeChildRowId,
        messageId: transactionId,
        swipeLabel: "Confirm exchange?",
        sheetTitle: "Confirm the item was given, or reject?",
        emitter: emitter,
        requestId: transactionId,
        responseValue: "transaction_completed"
      )
    }

    try XCTContext.runActivity(named: "Veto blocks pending on sold item") { _ in
      let vetoMessageId = UUID().uuidString.lowercased()
      let vetoFailed = try awaitResult("create pending on sold item") {
        do {
          _ = try await emitter.createResource(
            resource: EVYCoreResource.messages.ref,
            filter: ["id": vetoMessageId],
            data: [
              "id": vetoMessageId,
              "fk": self.shippingOwnedItemId,
              "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
              "visibility": "private",
              "type": "pickup",
              "value": "pending",
              "data": [:],
            ]
          )
          return false
        } catch {
          return error.localizedDescription.contains("sold")
        }
      }
      XCTAssertTrue(vetoFailed, "A pending request on a sold item should be vetoed")
      let rows = try awaitResult("verify veto message absent") {
        try await emitter.getResource(
          resource: EVYCoreResource.messages.ref,
          filter: ["id": vetoMessageId]
        ) as? [Any] ?? []
      }
      XCTAssertTrue(rows.isEmpty, "A vetoed create should leave no message row")
    }

    try XCTContext.runActivity(named: "Sold exclusion and rollback restore search") { _ in
      XCTAssertFalse(
        homeSearchShowsItem(title: "E2E Shipping Item", timeout: 3),
        "Sold items should be hidden from home search")

      _ = try seedPurchaseMessage(
        emitter: emitter,
        itemId: Self.seededBuyerItemId,
        type: "delivery",
        value: "failed",
        parentMessageId: deliveryPendingId,
        data: Self.settlingMessageData(time: Self.deliveryTimeslot)
      )
      try pollItemStatus(
        emitter: emitter, itemId: Self.seededBuyerItemId, expectedStatus: "available")
      XCTAssertTrue(
        homeSearchShowsItem(title: "Amazing Freezer", timeout: 15),
        "An item rolled back to available should reappear in home search")
      XCTAssertFalse(
        homeSearchShowsItem(title: "E2E Shipping Item", timeout: 3),
        "A still-sold item should remain hidden from home search")
    }

    try awaitResult("disconnect emitter") { await emitter.disconnect() }
  }

  @MainActor
  /// Each request needs its own item: accepting one moves the item to
  /// `pickup_pending`, and the marketplace vetoes a later `pending` on it.
  private func seedOwnRequest(
    emitter: WSEmitter,
    itemId: String,
    responseValue: String? = nil
  ) throws -> (requestId: String, responseId: String?) {
    let requestId = UUID().uuidString.lowercased()
    let responseId = responseValue == nil ? nil : UUID().uuidString.lowercased()
    return try awaitResult("seed owned item request") {
      _ = try await emitter.createResource(
        resource: EVYCoreResource.messages.ref,
        filter: ["id": requestId],
        data: [
          "id": requestId,
          "fk": itemId,
          "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
          "visibility": "private",
          "type": "pickup",
          "value": "pending",
          "data": [
            "time": "2026-06-03T09:00:00"
          ],
        ]
      )
      if let responseValue, let responseId {
        _ = try await emitter.createResource(
          resource: EVYCoreResource.messages.ref,
          filter: ["id": responseId],
          data: [
            "id": responseId,
            "fk": itemId,
            "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
            "visibility": "private",
            "parent_message_id": requestId,
            "type": "pickup",
            "value": responseValue,
            "data": Self.settlingMessageData(
              time: "2026-06-03T09:00:00",
              pickupAddress:
                responseValue == "accept"
                ? Self.amazingFridgePickupAddressRow : nil
            ),
          ]
        )
      }
      return (requestId, responseId)
    }
  }

  @MainActor
  private func assertResponsePersisted(
    emitter: WSEmitter,
    requestId: String,
    value: String,
    verifyRequestStillPending: Bool = true,
    file: StaticString = #filePath,
    line: UInt = #line
  ) throws -> String {
    let (answered, payload) = try awaitResult("wait for \(value) response") {
      let answered = try await self.waitForMessageResponse(
        emitter: emitter,
        messageId: requestId,
        value: value
      )
      let payload = try await emitter.getResource(
        resource: EVYCoreResource.messages.ref
      )
      return (answered, payload)
    }

    XCTAssertTrue(
      answered,
      "The API should hold a message answering the request with \(value)",
      file: file,
      line: line)
    if verifyRequestStillPending {
      // Answering writes nothing to the request: it supersedes the ask by being newer.
      XCTAssertTrue(
        Self.messageHasValue(payload, messageId: requestId, value: "pending"),
        "The request itself should still read as pending",
        file: file,
        line: line)
    }
    return try XCTUnwrap(
      Self.messageHasResponse(payload, messageId: requestId, value: value),
      "The response should include an id",
      file: file,
      line: line
    )
  }

  @MainActor
  private func readPickupStreetFromMessage(
    emitter: WSEmitter,
    messageId: String
  ) throws -> String {
    try awaitResult("read pickup_address from accept message") {
      let payload = try await emitter.getResource(
        resource: EVYCoreResource.messages.ref
      )
      guard let rows = Self.responseDataArray(from: payload),
        let message = rows.first(where: {
          ($0 as? [String: Any])?["id"] as? String == messageId
        }) as? [String: Any],
        let data = message["data"] as? [String: Any],
        let pickupAddress = data["pickup_address"] as? [String: Any],
        let street = pickupAddress["street"] as? String
      else {
        struct MissingPickupAddress: Error {}
        throw MissingPickupAddress()
      }
      return street
    }
  }

  private static func messageHasValue(_ messages: Any, messageId: String, value: String) -> Bool {
    guard let messageRows = responseDataArray(from: messages) else { return false }
    return messageRows.contains { message in
      guard let messageData = message as? [String: Any],
        messageData["id"] as? String == messageId
      else { return false }
      return messageData["value"] as? String == value
    }
  }

  @MainActor
  private func seedAcceptedRequest(
    emitter: WSEmitter,
    itemId: String,
    type: String,
    timeslot: String,
    destinationAddress: [String: Any]? = nil,
    pickupAddress: [String: Any]? = nil
  ) throws -> (pendingId: String, acceptId: String) {
    let pendingId = try seedPurchaseMessage(
      emitter: emitter,
      itemId: itemId,
      type: type,
      value: "pending",
      data: Self.settlingMessageData(
        time: timeslot,
        destinationAddress: destinationAddress,
        pickupAddress: pickupAddress
      )
    )
    let acceptId = try seedPurchaseMessage(
      emitter: emitter,
      itemId: itemId,
      type: type,
      value: "accept",
      parentMessageId: pendingId,
      data: Self.settlingMessageData(
        time: timeslot,
        destinationAddress: destinationAddress,
        pickupAddress: pickupAddress
      )
    )
    let expectedPendingStatus =
      switch type {
      case "pickup": "pickup_pending"
      case "delivery": "delivery_pending"
      case "shipping": "shipping_pending"
      default: type + "_pending"
      }
    try pollItemStatus(
      emitter: emitter, itemId: itemId, expectedStatus: expectedPendingStatus)
    return (pendingId, acceptId)
  }

  @MainActor
  private func runPaymentCapture(
    emitter: WSEmitter,
    itemId: String,
    authorizationMessageId: String
  ) throws {
    try awaitResult("capture payment") {
      let intent =
        try await emitter.callApi(
          service: EVY_CORE_SERVICE,
          method: "payment_intent",
          data: [
            "fk": itemId,
            "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
            "amount": 250,
            "currency": "AUD",
            "authorization_message_id": authorizationMessageId,
          ]
        ) as? [String: Any]
      guard let paymentIntentId = intent?["payment_provider_transaction_id"] as? String
      else {
        throw NSError(
          domain: "E2E", code: 1,
          userInfo: [
            NSLocalizedDescriptionKey: "payment_intent missing payment_provider_transaction_id"
          ]
        )
      }
      _ = try await emitter.callApi(
        service: EVY_CORE_SERVICE,
        method: "payment_capture",
        data: ["payment_intent_id": paymentIntentId]
      )
    }
  }

  @MainActor
  private func confirmViaSwipe(
    tab: String,
    childRowId: String,
    messageId: String,
    swipeLabel: String,
    sheetTitle: String,
    emitter: WSEmitter,
    requestId: String,
    responseValue: String
  ) throws -> String {
    app.segmentedControls.buttons[tab].tap()
    try swipeInboxRow(
      childRowId: childRowId,
      messageId: messageId,
      swipeLabel: swipeLabel
    )
    XCTAssertTrue(
      app.staticTexts[sheetTitle].waitForExistence(timeout: 5),
      "The confirmation sheet should open")
    try tapSheetConfirmButton()
    return try assertResponsePersisted(
      emitter: emitter,
      requestId: requestId,
      value: responseValue,
      verifyRequestStillPending: false
    )
  }

  @MainActor
  private func seedPurchaseMessage(
    emitter: WSEmitter,
    itemId: String,
    type: String,
    value: String,
    parentMessageId: String? = nil,
    data: [String: Any]? = nil
  ) throws -> String {
    let messageId = UUID().uuidString.lowercased()
    return try awaitResult("seed \(type)/\(value) message") {
      var messageData: [String: Any] = [
        "id": messageId,
        "fk": itemId,
        "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
        "visibility": "private",
        "type": type,
        "value": value,
        "data": data ?? [:],
      ]
      if let parentMessageId {
        messageData["parent_message_id"] = parentMessageId
      }
      _ = try await emitter.createResource(
        resource: EVYCoreResource.messages.ref,
        filter: ["id": messageId],
        data: messageData
      )
      return messageId
    }
  }

  @MainActor
  private func pollItemStatus(
    emitter: WSEmitter,
    itemId: String,
    expectedStatus: String,
    file: StaticString = #filePath,
    line: UInt = #line
  ) throws {
    let found = try awaitResult("poll item status \(expectedStatus)") {
      try await self.waitForResourceUpdate(
        emitter: emitter,
        resource: MARKETPLACE_ITEM_STATUSES_RESOURCE_ID
      ) { payload in
        Self.latestItemStatus(payload, itemId: itemId) == expectedStatus
      }
    }
    XCTAssertTrue(
      found,
      "Item \(itemId) should reach status \(expectedStatus)",
      file: file,
      line: line)
  }

  private static func latestItemStatus(_ payload: Any, itemId: String) -> String? {
    guard let rows = responseDataArray(from: payload) else { return "available" }
    let matching = rows.compactMap { $0 as? [String: Any] }.filter {
      ($0["item_id"] as? String) == itemId
    }
    guard !matching.isEmpty else { return "available" }
    let sorted = matching.sorted {
      ($0["created_at"] as? String ?? "") < ($1["created_at"] as? String ?? "")
    }
    return sorted.last?["status"] as? String
  }

  @MainActor
  private func swipeInboxRow(
    childRowId: String,
    messageId: String,
    swipeLabel: String
  ) throws {
    let row = app.otherElements["swipeRow_\(childRowId)_\(messageId)"]
    XCTAssertTrue(
      row.waitForExistence(timeout: 15),
      "Inbox row \(childRowId) for message \(messageId) should appear")
    XCTAssertTrue(scrollUntilHittable(row), "Inbox row should be reachable")
    row.swipeLeft(velocity: .slow)
    let swipeButton = app.buttons["swipeLeft_\(childRowId)_\(messageId)"]
    XCTAssertTrue(swipeButton.waitForExistence(timeout: 3), "Swipe action should appear")
    XCTAssertEqual(swipeButton.label, swipeLabel)
    swipeButton.tap()
  }

  @MainActor
  private func tapSheetConfirmButton() throws {
    let confirmButton = try XCTUnwrap(
      waitForHittableButton(labeled: "Confirm"),
      "Confirmation sheet should offer Confirm")
    confirmButton.tap()
  }

  @MainActor
  private func homeSearchShowsItem(title: String, timeout: TimeInterval) -> Bool {
    app.staticTexts[title].waitForExistence(timeout: timeout)
  }

  @MainActor
  private func ownRequestRow(requestId: String) -> XCUIElement {
    app.otherElements[
      "swipeRow_\(E2ETestBase.homeInboxForYouChildRowId)_\(requestId)"
    ]
  }
}
