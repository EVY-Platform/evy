//
//  EVYDraftBindingTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYDraftBindingTests: XCTestCase {
  override func tearDownWithError() throws {
    EVY.draftStore.activeScopeId = nil
    try super.tearDownWithError()
  }

  func testBindingSingleUUIDUsesEphemeralScope() throws {
    let uuid = "09f07052-c27c-4116-a508-a2bcb074c827"
    let binding = try EVYDraft.binding(parsedProps: uuid, scopeId: nil)
    XCTAssertEqual(binding.scopeId, "ephemeral:\(uuid)")
    XCTAssertEqual(binding.pathSegments, [uuid])
    guard case .aliasFlat(let segs) = binding.mergeMode else {
      XCTFail("expected aliasFlat merge mode")
      return
    }
    XCTAssertEqual(segs, [uuid])
  }

  func testBindingTitleDoesNotUseEphemeralScope() throws {
    let binding = try EVYDraft.binding(parsedProps: "title", scopeId: "flow:items")
    XCTAssertEqual(binding.scopeId, "flow:items")
    XCTAssertFalse(binding.scopeId.hasPrefix("ephemeral:"))
  }

  func testBindingUUIDWithMoreSegmentsIsNotEphemeralShortcut() throws {
    let uuid = "09f07052-c27c-4116-a508-a2bcb074c827"
    let binding = try EVYDraft.binding(
      parsedProps: "\(uuid).foo",
      scopeId: nil
    )
    XCTAssertNotEqual(binding.scopeId, "ephemeral:\(uuid)")
    XCTAssertEqual(binding.scopeId, EVYDraft.Scope.fallbackUnscoped)
    XCTAssertEqual(binding.pathSegments, [uuid, "foo"])
    guard case .explicitPath(let segs) = binding.mergeMode else {
      XCTFail("expected explicitPath merge mode")
      return
    }
    XCTAssertEqual(segs, [uuid, "foo"])
  }

  func testParseDraftKeySplitsOnLastColonForEphemeralKeys() throws {
    let uuid = "09f07052-c27c-4116-a508-a2bcb074c827"
    let binding = try EVYDraft.binding(parsedProps: uuid, scopeId: nil)

    let parsedBinding = try XCTUnwrap(EVYDraft.Binding.parseDraftKey(binding.draftKey))

    XCTAssertEqual(parsedBinding.scopeId, "ephemeral:\(uuid)")
    XCTAssertEqual(parsedBinding.pathSegments, [uuid])
    XCTAssertEqual(parsedBinding.mergeMode, binding.mergeMode)
  }

  func testDraftKeyRoundTripsBindingWithColonScope() throws {
    let binding = try EVYDraft.binding(
      parsedProps: "dimensions.width",
      scopeId: "flow:items"
    )

    let parsedBinding = try XCTUnwrap(EVYDraft.Binding.parseDraftKey(binding.draftKey))

    XCTAssertEqual(parsedBinding.scopeId, binding.scopeId)
    XCTAssertEqual(parsedBinding.pathSegments, binding.pathSegments)
    XCTAssertEqual(parsedBinding.mergeMode, binding.mergeMode)
  }

  func testScopeEntityKey() {
    let uuid = "09f07052-c27c-4116-a508-a2bcb074c827"
    let cases: [(scopeId: String?, expected: String?)] = [
      ("flow:items", "items"),
      ("flow:browse", nil),
      ("app:unscoped", nil),
      ("ephemeral:\(uuid)", nil),
      (nil, nil),
      ("", nil),
      ("   ", nil),
      ("flow", nil),
      ("flow:", nil),
      (":item", nil),
    ]

    for testCase in cases {
      XCTAssertEqual(
        EVYDraft.Scope.entityKey(fromScopeId: testCase.scopeId),
        testCase.expected,
        "scopeId: \(String(describing: testCase.scopeId))"
      )
    }
  }

  func testDraftNotifyUpdatePostsAliasAndEntityPathNotifications() throws {
    let store = EVYDataStore(name: "draft-notify-test", inMemoryOnly: true)
    let draftStore = EVYDraftStore(dataStore: store)
    let binding = try EVYDraft.binding(parsedProps: "condition", scopeId: "flow:item")
    var notificationKeys: [String] = []
    let token = NotificationCenter.default.addObserver(
      forName: .evyDataChanged,
      object: nil,
      queue: .main
    ) { notification in
      if let key = notification.object as? String {
        notificationKeys.append(key)
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    draftStore.notifyUpdate(binding: binding)

    XCTAssertEqual(notificationKeys, ["condition", "item.condition"])
  }

  func testDraftNotifyUpdateDoesNotDuplicateAlreadyEntityQualifiedNotification() throws {
    let store = EVYDataStore(name: "draft-notify-qualified-test", inMemoryOnly: true)
    let draftStore = EVYDraftStore(dataStore: store)
    let binding = EVYDraft.Binding(
      scopeId: "flow:item",
      pathSegments: ["item", "condition"],
      mergeMode: .explicitPath(pathSegments: ["item", "condition"])
    )
    var notificationKeys: [String] = []
    let token = NotificationCenter.default.addObserver(
      forName: .evyDataChanged,
      object: nil,
      queue: .main
    ) { notification in
      if let key = notification.object as? String {
        notificationKeys.append(key)
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    draftStore.notifyUpdate(binding: binding)

    XCTAssertEqual(notificationKeys, ["item.condition"])
  }

  func testWriteRawValueBuildsCurrencyAtDestination() throws {
    let key = uniqueKey("item_price")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId

    try EVY.writeRawValue("99", to: "{buildCurrency(\(key))}", scopeId: scopeId)

    let stored = try EVY.getDataFromText("{\(key)}")
    XCTAssertEqual(
      stored,
      .dictionary([
        "currency": .string("AUD"),
        "value": .int(99),
      ])
    )
  }

  func testDestinationOnlyDisplayAndEditableTextReadDraftValueAfterWrite() throws {
    let key = uniqueKey("title")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId
    let destination = "{\(key)}"

    try EVY.writeRawValue("Persisted title", to: destination, scopeId: scopeId)

    XCTAssertEqual(
      EVY.displayText(fromSource: nil, destination: destination),
      "Persisted title"
    )
    XCTAssertEqual(
      EVY.editableText(fromSource: nil, destination: destination),
      "Persisted title"
    )
  }

  private func uniqueKey(_ suffix: String) -> String {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    return "evy_draft_binding_tests_\(suffix)_\(randomId)"
  }
}
