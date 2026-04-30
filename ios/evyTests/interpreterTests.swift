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
    XCTAssertFalse(
      try EVY.evaluateFromText("{count(\(titleKey)) > 10 && count(\(reasonsKey)) > 3}"))
  }

  func testEvaluatesBarePropsInsideComparison() throws {
    let paymentCashKey = uniqueKey("payment_cash")
    let paymentAppKey = uniqueKey("payment_app")

    try store(.bool(false), at: paymentCashKey)
    try store(.bool(true), at: paymentAppKey)

    XCTAssertTrue(
      try EVY.evaluateFromText("{\(paymentCashKey) == true || \(paymentAppKey) == true}"))
    XCTAssertFalse(
      try EVY.evaluateFromText("{\(paymentCashKey) == true && \(paymentAppKey) == false}"))
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

  func testLocalPrefixRoutesToPrivateDataStore() throws {
    let key = uniqueKey("local_routing")
    try store(.string("public"), at: key)

    let (localStore, localKey) = EVY.store(for: "$local.\(key)")
    try localStore.create(
      key: localKey,
      data: try JSONEncoder().encode(EVYJson.string("private"))
    )

    let publicValue = try parseTextFromText("value: {\(key)}")
    let privateValue = try parseTextFromText("value: {$local.\(key)}")

    XCTAssertEqual(publicValue.value, "value: public")
    XCTAssertEqual(privateValue.value, "value: private")
    XCTAssertEqual(EVY.watchTarget(for: "{$local.\(key)}"), key)
  }

  func testCountReflectsArrayAfterStoreUpdate() throws {
    let key = uniqueKey("photos")
    try store(.array([.string("a")]), at: key)
    let one = try parseTextFromText("n: {count(\(key))}")
    XCTAssertEqual(one.value, "n: 1")

    let encoded = try JSONEncoder().encode(EVYJson.array([.string("a"), .string("b")]))
    try EVY.publicStore.update(props: [key], data: encoded)

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

  func testResolveQueryParamsStoresMatchingEntityUnderQueryKey() throws {
    let entityKey = uniqueKey("entities")
    let firstId = UUID().uuidString
    let secondId = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(firstId),
          "title": .string("First item"),
        ]),
        .dictionary([
          "id": .string(secondId),
          "title": .string("Selected item"),
        ]),
      ]),
      at: "marketplace:\(entityKey)"
    )

    EVY.resolveQueryParams([entityKey: [secondId]])

    XCTAssertEqual(try EVY.getDataFromText("{\(entityKey).title}"), .string("Selected item"))
  }

  func testResolveQueryParamsInfersServiceFromSyncedResourceKey() throws {
    let entityKey = uniqueKey("entities")
    let id = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected from other service"),
        ])
      ]),
      at: "other_service:\(entityKey)"
    )

    EVY.resolveQueryParams([entityKey: [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(entityKey).title}"), .string("Selected from other service"))
  }

  func testResolveQueryParamsUsesFirstIdWhenMultipleIdsAreProvided() throws {
    let entityKey = uniqueKey("entities")
    let firstId = UUID().uuidString
    let secondId = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(firstId),
          "title": .string("First selected item"),
        ]),
        .dictionary([
          "id": .string(secondId),
          "title": .string("Second item"),
        ]),
      ]),
      at: "marketplace:\(entityKey)"
    )

    EVY.resolveQueryParams([entityKey: [firstId, secondId]])

    XCTAssertEqual(try EVY.getDataFromText("{\(entityKey).title}"), .string("First selected item"))
  }

  func testResolveQueryParamsStoresRawValuesWhenNoSyncedCollectionExists() throws {
    let key = uniqueKey("tag_ids")
    let firstId = UUID().uuidString
    let secondId = UUID().uuidString

    EVY.resolveQueryParams([key: [firstId, secondId]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(key)}"),
      .array([.string(firstId), .string(secondId)])
    )
  }

  func testParseSourceParamsSeparatesBasePathAndParamEntries() {
    let result = parseSourceParams(
      "$api:marketplace:items:suggestions({\"tag_ids\", \"limit\": 1, \"ids\": [\"id-1\"]})"
    )

    XCTAssertEqual(result.basePath, "$api:marketplace:items:suggestions")
    XCTAssertEqual(
      result.params,
      [
        .interpolated(key: "tag_ids"),
        .staticValue(key: "limit", value: .int(1)),
        .staticValue(key: "ids", value: .array([.string("id-1")])),
      ]
    )
  }

  func testParseSourceParamsIgnoresMalformedParamObject() {
    let result = parseSourceParams(
      "$api:marketplace:items:suggestions(\"tag_ids\", \"limit\": 1)"
    )

    XCTAssertEqual(result.basePath, "$api:marketplace:items:suggestions")
    XCTAssertEqual(result.params, [])
  }

  func testParseFullBracedBindingAllowsNestedParamObject() {
    XCTAssertEqual(
      parseFullBracedBinding("{$api:marketplace:items:suggestions({\"limit\": 1})}"),
      "$api:marketplace:items:suggestions({\"limit\": 1})"
    )
  }

  func testResolveParamsUsesStaticValuesAndStoredInterpolatedValues() throws {
    let key = uniqueKey("tag_ids")
    try store(.array([.string("tag-1")]), at: key)

    let resolvedParams = EVY.resolveParams([
      .interpolated(key: key),
      .staticValue(key: "limit", value: .int(1)),
    ])

    XCTAssertEqual(resolvedParams[key], .array([.string("tag-1")]))
    XCTAssertEqual(resolvedParams["limit"], .int(1))
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
    if EVY.publicStore.exists(key: key) {
      try EVY.publicStore.delete(key: key)
    }
    let encodedValue = try JSONEncoder().encode(value)
    try EVY.publicStore.create(key: key, data: encodedValue)
  }

  private func uniqueKey(_ suffix: String) -> String {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    return "evy_interpreter_tests_\(suffix)_\(randomId)"
  }
}
