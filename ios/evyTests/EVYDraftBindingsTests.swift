//
//  EVYDraftBindingTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYDraftBindingTests: XCTestCase {
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

  func testDraftKeyPrefixUsesColonSeparator() {
    XCTAssertEqual(EVYDraft.Binding.draftKeyPrefix(forScopeId: "flow:items"), "flow:items:")
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

  func testScopeEntityKeyParsesEntityScopes() {
    XCTAssertEqual(EVYDraft.Scope.entityKey(fromScopeId: "flow:items"), "items")
  }

  func testScopeEntityKeyReturnsNilForReservedScopes() {
    let uuid = "09f07052-c27c-4116-a508-a2bcb074c827"

    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: "flow:browse"))
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: "app:unscoped"))
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: "ephemeral:\(uuid)"))
  }

  func testScopeEntityKeyReturnsNilForNilEmptyOrMalformedScopes() {
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: nil))
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: ""))
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: "   "))
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: "flow"))
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: "flow:"))
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: ":item"))
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
}
