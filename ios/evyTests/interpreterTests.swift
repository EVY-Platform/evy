//
//  interpreterTests.swift
//  evyTests
//

import XCTest
@testable import evy

@MainActor
final class InterpreterTests: XCTestCase {
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

    func testWatchTargetUnwrapsCountToUnderlyingDataKey() {
        let key = uniqueKey("photo_ids")
        XCTAssertEqual(
            EVY.watchTarget(for: "Photos: {count(\(key))}/10 - more text"),
            key
        )
    }

    func testWatchTargetUsesFirstArgumentForMultiArgFunction() {
        XCTAssertEqual(
            EVY.watchTarget(for: "{formatDecimal(item.price, 2)}"),
            "item.price"
        )
    }

    func testCountReflectsArrayAfterStoreUpdate() throws {
        let key = uniqueKey("photos")
        try store(.array([.string("a")]), at: key)
        let one = try parseTextFromText("n: {count(\(key))}")
        XCTAssertEqual(one.value, "n: 1")

        let encoded = try JSONEncoder().encode(EVYJson.array([.string("a"), .string("b")]))
        try EVY.data.update(props: [key], data: encoded)

        let two = try parseTextFromText("n: {count(\(key))}")
        XCTAssertEqual(two.value, "n: 2")
    }

    func testFormatDecimalRoundsToPlaces() throws {
        let key = uniqueKey("amount")
        try store(.string("20.0423"), at: key)
        let out = try parseTextFromText("{formatDecimal(\(key), 2)}")
        XCTAssertEqual(out.value, "20.04")
    }

    func testFormatMetricLengthUsesTwoDecimalMetres() throws {
        let key = uniqueKey("mm")
        try store(.int(23240), at: key)
        let out = try parseTextFromText("{formatMetricLength(\(key))}")
        XCTAssertEqual(out.toString(), "23.24m")
    }

    func testFormatImperialLengthConvertsMillimetresToFeet() throws {
        let key = uniqueKey("mm")
        try store(.int(4231), at: key)
        let out = try parseTextFromText("{formatImperialLength(\(key))}")
        XCTAssertEqual(out.toString(), "13.88ft")
    }

    func testFormatDurationHumanizesMilliseconds() throws {
        let key = uniqueKey("ms")
        try store(.int(900_000), at: key)
        let out = try parseTextFromText("{formatDuration(\(key))}")
        XCTAssertEqual(out.value, "15 minutes")
    }

    func testFormatDateFormatsIsoStringWithPattern() throws {
        let key = uniqueKey("created")
        try store(.string("2024-01-19T12:42:52.000Z"), at: key)
        let out = try parseTextFromText(
            "{formatDate(\(key), \"MM/dd/yyyy\")}"
        )
        XCTAssertEqual(out.value, "01/19/2024")
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
