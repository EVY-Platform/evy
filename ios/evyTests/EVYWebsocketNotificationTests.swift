//
//  EVYWebsocketNotificationTests.swift
//  evyTests
//

import XCTest
@testable import evy

final class EVYWebsocketNotificationTests: XCTestCase {
    func testFlowUpdatedPayloadDecodesAsExpectedShape() throws {
        let jsonString = """
        {"id":"flow-row-id","createdAt":"2024-01-19T12:00:00.000Z","updatedAt":"2024-01-19T12:00:00.000Z","data":{"id":"f1","name":"Hello","pages":[]}}
        """
        let data = try XCTUnwrap(jsonString.data(using: .utf8))
        let top = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: data) as? [String: Any],
        )
        XCTAssertEqual(top["id"] as? String, "flow-row-id")
        XCTAssertNotNil(top["createdAt"])
        XCTAssertNotNil(top["updatedAt"])
        let inner = try XCTUnwrap(top["data"] as? [String: Any])
        XCTAssertEqual(inner["id"] as? String, "f1")
        XCTAssertEqual(inner["name"] as? String, "Hello")
        let pages = try XCTUnwrap(inner["pages"] as? [Any])
        XCTAssertEqual(pages.count, 0)
    }

    func testDataUpdatedPayloadDecodesAsExpectedShape() throws {
        let jsonString = """
        {"id":"data-row-id","name":"x","description":"d","createdAt":"2024-01-19T12:00:00.000Z","updatedAt":"2024-01-19T12:00:00.000Z"}
        """
        let data = try XCTUnwrap(jsonString.data(using: .utf8))
        let top = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: data) as? [String: Any],
        )
        XCTAssertEqual(top["id"] as? String, "data-row-id")
        XCTAssertEqual(top["name"] as? String, "x")
        XCTAssertEqual(top["description"] as? String, "d")
    }

    func testEVYRPCErrorDescriptions() {
        XCTAssertEqual(
            EVYRPCError.loginError.errorDescription,
            "Authentication failed",
        )
        XCTAssertTrue(
            (EVYRPCError.connectionError("oops").errorDescription ?? "").contains(
                "oops",
            ),
        )
        XCTAssertEqual(
            EVYRPCError.rpcError(code: 1, message: "bad").errorDescription,
            "bad",
        )
        XCTAssertEqual(
            EVYRPCError.subscriptionError("sub").errorDescription,
            "Subscription error: sub",
        )
    }
}
