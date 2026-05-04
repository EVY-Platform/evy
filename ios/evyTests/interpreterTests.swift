//
//  interpreterTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class InterpreterTests: XCTestCase {
  private var testPrefix = ""

  override func setUpWithError() throws {
    try super.setUpWithError()
    testPrefix = "test_page_\(UUID().uuidString):"
    try EVY.getUserData()
    EVY.activeCachePrefix = testPrefix
  }

  override func tearDownWithError() throws {
    EVY.cacheStore.deleteAll(keyPrefix: testPrefix)
    EVY.activeCachePrefix = nil
    EVY.draftStore.activeScopeId = nil
    try super.tearDownWithError()
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

  func testResolveQueryParamsStoresSingleRawValueAsScalar() throws {
    let key = uniqueKey("query_text")

    EVY.resolveQueryParams([key: ["test"]])

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("test"))
  }

  func testResolveQueryParamsOverwritesPreviousPageData() throws {
    let key = uniqueKey("param")
    let prefix1 = "page_a:"
    let prefix2 = "page_b:"

    // Write to page A
    EVY.activeCachePrefix = prefix1
    EVY.resolveQueryParams([key: ["value_a"]])

    // Write to page B with same key
    EVY.activeCachePrefix = prefix2
    EVY.resolveQueryParams([key: ["value_b"]])

    // Page B data is correct
    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("value_b"))

    // Page A data still exists (different prefix, inert)
    EVY.activeCachePrefix = prefix1
    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("value_a"))
  }

  func testCacheStoreOverridesPublicStoreForActivePagePrefix() throws {
    let key = uniqueKey("shared")
    try store(.string("public"), at: key)

    EVY.resolveQueryParams([key: ["cache"]])

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("cache"))
  }

  func testPublicStoreUsedWhenCacheHasNoActivePageValue() throws {
    let key = uniqueKey("public_only")
    try store(.string("public"), at: key)

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("public"))
  }

  func testActiveCachePrefixSelectsPageScopedValue() throws {
    let key = uniqueKey("shared")
    let pageOnePrefix = "page_one_\(UUID().uuidString):"
    let pageTwoPrefix = "page_two_\(UUID().uuidString):"

    EVY.activeCachePrefix = pageOnePrefix
    EVY.resolveQueryParams([key: ["one"]])

    EVY.activeCachePrefix = pageTwoPrefix
    EVY.resolveQueryParams([key: ["two"]])

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("two"))

    EVY.activeCachePrefix = pageOnePrefix
    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("one"))
  }

  func testDraftStoreOverridesCacheStore() throws {
    let key = uniqueKey("draft_over_cache")
    let scopeId = "scope_\(UUID().uuidString)"

    EVY.resolveQueryParams([key: ["cache"]])

    let binding = try EVY.draftStore.binding(fromParsedProps: key, scopeId: scopeId)
    try EVY.draftStore.upsert(
      binding: binding,
      data: try JSONEncoder().encode(EVYJson.string("draft"))
    )
    EVY.draftStore.activeScopeId = scopeId

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("draft"))
  }

  func testResolveQueryParamsEmptyIsNoOp() throws {
    let key = uniqueKey("param")

    EVY.resolveQueryParams([key: ["value"]])
    EVY.resolveQueryParams([:])

    // Data unchanged by empty call
    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("value"))
  }

  func testResolveQueryParamsResolvesEntityFromPublicStore() throws {
    let entityKey = uniqueKey("entities")
    let id = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected item"),
        ])
      ]),
      at: "marketplace:\(entityKey)"
    )

    EVY.resolveQueryParams([entityKey: [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(entityKey).title}"),
      .string("Selected item")
    )
  }

  func testResolveParamsReadsFromCacheStore() throws {
    EVY.resolveQueryParams([
      "tag_ids": ["tag-1", "tag-2"],
      "query_text": ["test"],
    ])

    let resolvedParams = EVY.resolveParams([
      .interpolated(key: "tag_ids"),
      .interpolated(key: "query_text"),
    ])

    XCTAssertEqual(resolvedParams["tag_ids"], .array([.string("tag-1"), .string("tag-2")]))
    XCTAssertEqual(resolvedParams["query_text"], .string("test"))
  }

  func testGetValueFromTextResolvesCacheStoreData() throws {
    EVY.resolveQueryParams(["query_text": ["test"]])

    XCTAssertEqual(
      try EVY.getValueFromText("{query_text}").toString(),
      "test"
    )
  }

  func testGetValueFromTextFallsBackToLiteralText() throws {
    XCTAssertEqual(
      try EVY.getValueFromText("plain text").toString(),
      "plain text"
    )
  }

  func testCacheStoreReturnsNilForUnknownKey() throws {
    // Data was never written for this key
    let missingKey = uniqueKey("missing")
    XCTAssertThrowsError(try EVY.getDataFromText("{\(missingKey)}"))
  }

  func testResolveQueryParamsIsIdempotent() throws {
    let key = uniqueKey("param")
    EVY.resolveQueryParams([key: ["value"]])
    EVY.resolveQueryParams([key: ["value"]])
    EVY.resolveQueryParams([key: ["value"]])

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("value"))
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
