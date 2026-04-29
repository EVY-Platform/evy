//
//  EVYDraftBindingTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYDraftBindingTests: XCTestCase {
  func testBindingSingleUUIDUsesEphemeralScope() throws {
    let uuid = "00000000-0000-4000-8000-000000000001"
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
    let uuid = "00000000-0000-4000-8000-000000000001"
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
    let uuid = "00000000-0000-4000-8000-000000000001"
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
    let uuid = "00000000-0000-4000-8000-000000000001"

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
}
