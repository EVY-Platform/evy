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
        let binding = try EVYDraft.binding(parsedProps: "title", scopeId: "flow#item")
        XCTAssertEqual(binding.scopeId, "flow#item")
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
}
