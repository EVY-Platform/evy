//
//  EVYInterpreterTests.swift
//  evyTests
//
//  Created by Cursor on 13/3/2026.
//

import XCTest
@testable import evy

@MainActor
final class EVYInterpreterTests: XCTestCase {
    override func setUpWithError() throws {
        try super.setUpWithError()
        try EVY.getUserData()
    }

    func testEvaluatesLogicalOperatorsWithLiterals() throws {
        XCTAssertTrue(try EVY.evaluateFromText("{0 > 1 || 1 > 0}"))
        XCTAssertFalse(try EVY.evaluateFromText("{0 > 1 || 0 > 2}"))
        XCTAssertTrue(try EVY.evaluateFromText("{1 > 0 && 2 > 1}"))
        XCTAssertFalse(try EVY.evaluateFromText("{1 > 0 && 0 > 1}"))
    }

    func testEvaluatesGroupedLogicalOperators() throws {
        XCTAssertTrue(try EVY.evaluateFromText("{0 > 1 || (1 > 0 && 2 > 1)}"))
        XCTAssertFalse(try EVY.evaluateFromText("{(0 > 1 || 1 > 2) && 2 > 3}"))
        XCTAssertTrue(try EVY.evaluateFromText("{0 > 1 || 0 > 2 || 1 > 0}"))
    }

    func testEvaluatesFunctionOperands() throws {
        let titleKey = uniqueKey("title")
        let reasonsKey = uniqueKey("reasons")

        try store(.string("Hello"), at: titleKey)
        try store(.array([.string("One"), .string("Two")]), at: reasonsKey)

        XCTAssertTrue(try EVY.evaluateFromText("{count(\(titleKey)) > 0 || count(\(reasonsKey)) > 3}"))
        XCTAssertFalse(try EVY.evaluateFromText("{count(\(titleKey)) > 10 && count(\(reasonsKey)) > 3}"))
    }

    func testEvaluatesBarePropsInsideComparison() throws {
        let paymentCashKey = uniqueKey("payment_cash")
        let paymentAppKey = uniqueKey("payment_app")

        try store(.bool(false), at: paymentCashKey)
        try store(.bool(true), at: paymentAppKey)

        XCTAssertTrue(try EVY.evaluateFromText("{\(paymentCashKey) == true || \(paymentAppKey) == true}"))
        XCTAssertFalse(try EVY.evaluateFromText("{\(paymentCashKey) == true && \(paymentAppKey) == false}"))
    }

    func testReplacesComparisonInsideText() throws {
        let result = try EVYInterpreter.parseTextFromText("result: {1 > 0 || 2 > 0}")
        XCTAssertEqual(result.value, "result: true")
    }

    private func store(_ value: EVYJson, at key: String) throws {
        if EVY.data.exists(key: key) {
            try EVY.data.delete(key: key)
        }
        let encodedValue = try JSONEncoder().encode(value)
        try EVY.data.create(key: key, data: encodedValue)
    }

    private func uniqueKey(_ suffix: String) -> String {
        let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
        return "evy_interpreter_tests_\(suffix)_\(randomId)"
    }
}
