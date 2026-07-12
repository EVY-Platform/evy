//
//  interpreterTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class InterpreterTests: XCTestCase {
  private var testPageId = ""

  override func setUpWithError() throws {
    try super.setUpWithError()
    testPageId = "test_page_\(UUID().uuidString)"
    EVY.activeCacheScopeId = testPageId
  }

  override func tearDownWithError() throws {
    try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: testPageId)
    EVY.draftStore.deleteDrafts()
    EVY.activeCacheScopeId = nil
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

  func testWatchTargetsExtractsMultipleOperandsFromOrCondition() {
    XCTAssertEqual(
      Set(EVY.watchTargets(for: "{payment_cash == true || payment_app == true}")),
      Set(["payment_cash", "payment_app"]))
  }

  func testWatchTargetsIgnoresNumericLiterals() {
    XCTAssertEqual(
      EVY.watchTargets(for: "{1 > 0 || item.enabled == true}"),
      ["item.enabled"])
  }

  func testEvaluatesNestedPaymentMethodVisibility() throws {
    let itemKey = uniqueKey("item")
    try store(
      .dictionary([
        "payment_methods": .dictionary([
          "cash": .bool(true),
          "app": .bool(false),
        ])
      ]),
      at: itemKey)

    XCTAssertTrue(try EVY.evaluateFromText("{\(itemKey).payment_methods.cash == true}"))
    XCTAssertFalse(try EVY.evaluateFromText("{\(itemKey).payment_methods.app == true}"))
  }

  func testWatchTargetsExtractsSingleWrappedProp() {
    XCTAssertEqual(EVY.watchTargets(for: "{item.title}"), ["item.title"])
  }

  func testWatchTargetsUnwrapsCountToUnderlyingDataKey() {
    let key = uniqueKey("photo_ids")
    XCTAssertEqual(
      EVY.watchTargets(for: "Photos: {count(\(key))}/10 - more text"),
      [key]
    )
  }

  func testWatchTargetsIgnoresLiteralFunctionArguments() {
    XCTAssertEqual(
      EVY.watchTargets(for: "{formatDecimal(item.price, 2)}"),
      ["item.price"]
    )
  }

  func testWatchTargetsExtractsMultipleInterpolations() {
    XCTAssertEqual(
      EVY.watchTargets(for: "{item.title} - {seller.name}"),
      ["item.title", "seller.name"]
    )
  }

  func testWatchTargetsExtractsAllFunctionsFromMixedInterpolation() {
    XCTAssertEqual(
      EVY.watchTargets(
        for: "{formatDimension(item.dimensions.width) x formatDimension(item.dimensions.height)}"),
      ["item.dimensions.width", "item.dimensions.height"]
    )
  }

  func testWatchTargetsExtractsAllDataFunctionArguments() {
    XCTAssertEqual(
      EVY.watchTargets(for: "{compare(item.width, item.height)}"),
      ["item.width", "item.height"]
    )
  }

  func testLocalPrefixRoutesToPrivateDataStore() throws {
    let key = uniqueKey("local_routing")
    try store(.string("public"), at: key)

    let (localStore, localKey) = EVY.store(for: "$local:\(key)")
    try localStore.create(
      namespace: EVYNamespace.local,
      resource: localKey,
      id: EVYNamespace.singletonId,
      value: try JSONEncoder().encode(EVYJson.string("private"))
    )

    let publicValue = try parseTextFromText("value: {\(key)}")
    let privateValue = try parseTextFromText("value: {$local:\(key)}")

    XCTAssertEqual(publicValue.value, "value: public")
    XCTAssertEqual(privateValue.value, "value: private")
    XCTAssertEqual(EVY.watchTargets(for: "{$local:\(key)}"), [key])
  }

  func testApiPrefixRoutesToPublicDataStore() throws {
    let key = uniqueKey("api_routing")
    try store(.string("api_value"), at: key)

    let (apiStore, apiKey) = EVY.store(for: "$api:\(key)")
    XCTAssertTrue(apiStore === EVY.publicStore)
    XCTAssertEqual(apiKey, key)

    let value = try parseTextFromText("value: {$api:\(key)}")
    XCTAssertEqual(value.value, "value: api_value")
    XCTAssertEqual(EVY.watchTargets(for: "{$api:\(key)}"), [key])
  }

  func testCountReflectsArrayAfterStoreUpdate() throws {
    let key = uniqueKey("photos")
    try store(.array([.string("a")]), at: key)
    let one = try parseTextFromText("n: {count(\(key))}")
    XCTAssertEqual(one.value, "n: 1")

    let encoded = try JSONEncoder().encode(EVYJson.array([.string("a"), .string("b")]))
    if let existing = try EVY.publicStore.getAll().first(where: { $0.resource == key }) {
      existing.data = encoded
    }

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

  func testGetValueFromTextEvaluatesMultipleFunctionsInSingleBraceBlock() throws {
    let key = try storeDimensions(width: 200, height: 300)
    XCTAssertEqual(
      try EVY.getValueFromText(
        "{formatDimension(\(key).dimensions.width) x formatDimension(\(key).dimensions.height)}"
      ).toString(),
      "20cm x 30cm"
    )
  }

  func testGetValueFromTextEvaluatesMultipleFunctionsInsideWrappedText() throws {
    let key = try storeDimensions(width: 200, height: 300)
    XCTAssertEqual(
      try EVY.getValueFromText(
        "Size: {formatDimension(\(key).dimensions.width) x formatDimension(\(key).dimensions.height)}"
      ).toString(),
      "Size: 20cm x 30cm"
    )
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
      at: "\(EVYNamespace.marketplace):\(entityKey)"
    )

    EVY.resolveQueryParams([entityKey: [secondId]])

    XCTAssertEqual(try EVY.getDataFromText("{\(entityKey).title}"), .string("Selected item"))
  }

  func testResolveQueryParamsDoesNotCacheSingularAlias() throws {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    let resourceKey = "evy_interpreter_tests_\(randomId)_items"
    let entityKey = "evy_interpreter_tests_\(randomId)_item"
    let id = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected exact item"),
        ])
      ]),
      at: "\(EVYNamespace.marketplace):\(resourceKey)"
    )

    EVY.resolveQueryParams([resourceKey: [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(resourceKey).title}"),
      .string("Selected exact item")
    )
    XCTAssertThrowsError(try EVY.getDataFromText("{\(entityKey).title}"))
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
      at: "\(EVYNamespace.marketplace):\(entityKey)"
    )

    EVY.resolveQueryParams([entityKey: [firstId, secondId]])

    XCTAssertEqual(try EVY.getDataFromText("{\(entityKey).title}"), .string("First selected item"))
  }

  func testResolveQueryParamsStoresRawValuesWhenNoSyncedCollectionExists() throws {
    let key = uniqueKey("filters")
    let firstId = UUID().uuidString
    let secondId = UUID().uuidString

    EVY.resolveQueryParams([key: [firstId, secondId]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(key)}"),
      .array([.string(firstId), .string(secondId)])
    )
  }

  func testResolveQueryParamsStoresSingleRawValueAsScalar() throws {
    let key = uniqueKey("query")

    EVY.resolveQueryParams([key: ["test"]])

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("test"))
  }

  func testResolveQueryParamsOverwritesPreviousPageData() throws {
    let key = uniqueKey("param")
    let pageA = "page_a_\(UUID().uuidString)"
    let pageB = "page_b_\(UUID().uuidString)"

    // Write to page A
    EVY.activeCacheScopeId = pageA
    EVY.resolveQueryParams([key: ["value_a"]])

    // Write to page B with same key
    EVY.activeCacheScopeId = pageB
    EVY.resolveQueryParams([key: ["value_b"]])

    // Page B data is correct
    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("value_b"))

    EVY.activeCacheScopeId = pageA
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
    let pageOneId = "page_one_\(UUID().uuidString)"
    let pageTwoId = "page_two_\(UUID().uuidString)"

    EVY.activeCacheScopeId = pageOneId
    EVY.resolveQueryParams([key: ["one"]])

    EVY.activeCacheScopeId = pageTwoId
    EVY.resolveQueryParams([key: ["two"]])

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("two"))

    EVY.activeCacheScopeId = pageOneId
    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("one"))
  }

  func testCollectionResolvesFromPinnedScopeNotGlobalScope() throws {
    let itemsKey = uniqueKey("items")
    let homePageId = "home-\(UUID().uuidString)"
    let detailPageId = "detail-\(UUID().uuidString)"

    let item1 = EVYJson.dictionary(["id": .string("id-1"), "title": .string("Item 1")])
    let item2 = EVYJson.dictionary(["id": .string("id-2"), "title": .string("Item 2")])
    try EVY.publicStore.applySyncedValue(
      namespace: EVYNamespace.marketplace, resource: itemsKey, value: .array([item1, item2]))

    let encoded = try JSONEncoder().encode(item1)
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: detailPageId, id: itemsKey, value: encoded)

    EVY.activeCacheScopeId = detailPageId
    let resultOnDetail = try EVY.getDataFromText("{\(itemsKey)}")
    XCTAssertEqual(resultOnDetail, item1, "Detail page scope resolves to single cached item")

    EVY.activeCacheScopeId = homePageId
    let resultOnHome = try EVY.getDataFromText("{\(itemsKey)}")
    guard case .array(let homeItems) = resultOnHome else {
      XCTFail("Expected array from home scope")
      return
    }
    XCTAssertEqual(homeItems.count, 2, "Home scope resolves to full collection")
  }

  func testDraftStoreOverridesCacheStore() throws {
    let key = uniqueKey("draft_over_cache")
    let scopeId = "scope_\(UUID().uuidString)"

    EVY.resolveQueryParams([key: ["cache"]])

    let binding = try EVY.draftStore.binding(fromParsedProps: key, scopeId: scopeId)
    try EVY.cacheStore.create(
      namespace: EVYNamespace.draft,
      resource: binding.scopeId,
      id: binding.draftKey,
      value: try JSONEncoder().encode(EVYJson.string("draft"))
    )
    EVY.draftStore.activeScopeId = scopeId

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("draft"))
  }

  // MARK: - Ephemeral drafts

  func testEnsureDraftExistsDoesNotShadowCachedInstanceValue() throws {
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: testPageId)
    EVY.draftStore.activeScopeId = scopeId

    let item = EVYJson.dictionary(["id": .string("id-1"), "title": .string("Real title")])
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache,
      resource: testPageId,
      id: "item",
      value: try JSONEncoder().encode(item)
    )

    EVY.ensureDraftExists(variableName: "item.title", scopeId: scopeId)

    let binding = try EVY.draftStore.binding(fromParsedProps: "item.title", scopeId: scopeId)
    XCTAssertNil(
      EVY.draftStore.draftIfPresent(binding: binding),
      "Bootstrap must not create an empty draft over existing cached data")
    XCTAssertEqual(try EVY.getDataFromText("{item.title}"), .string("Real title"))
  }

  func testEnsureDraftExistsSeedsWhenNoInstanceValueExists() throws {
    let variableName = "\(uniqueKey("item")).title"
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: testPageId)
    EVY.draftStore.activeScopeId = scopeId

    EVY.ensureDraftExists(variableName: variableName, scopeId: scopeId)

    let binding = try EVY.draftStore.binding(fromParsedProps: variableName, scopeId: scopeId)
    XCTAssertNotNil(
      EVY.draftStore.draftIfPresent(binding: binding),
      "Bootstrap should seed an empty draft when no instance data exists")
    XCTAssertEqual(try EVY.getDataFromText("{\(variableName)}"), .string(""))
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
      at: "\(EVYNamespace.marketplace):\(entityKey)"
    )

    EVY.resolveQueryParams([entityKey: [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(entityKey).title}"),
      .string("Selected item")
    )
  }

  func testResolveQueryParamsResolvesGenericIdFromSyncedCollection() throws {
    let entityKey = uniqueKey("entities")
    let id = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected by generic id"),
        ])
      ]),
      at: "\(EVYNamespace.marketplace):\(entityKey)"
    )

    EVY.resolveQueryParams(["id": [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(entityKey).title}"),
      .string("Selected by generic id")
    )
  }

  func testGetValueFromTextResolvesCacheStoreData() throws {
    EVY.resolveQueryParams(["query": ["test"]])

    XCTAssertEqual(
      try EVY.getValueFromText("{query}").toString(),
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

  func testFormatDatetimeFormatsIsoStringWithPattern() throws {
    let key = uniqueKey("created")
    try store(.string("2026-06-03T09:30:00.000Z"), at: key)

    let date = try parseTextFromText("{formatDatetime(\(key), \"MM/dd/yyyy\")}")
    let header = try parseTextFromText("{formatDatetime(\(key), \"EEE d\")}")
    let time = try parseTextFromText("{formatDatetime(\(key), \"HH:mm\")}")

    XCTAssertEqual(date.value, "06/03/2026")
    XCTAssertEqual(header.value, "Wed 3")
    XCTAssertEqual(time.value, "09:30")
  }

  func testFormatDatetimeSupportsIsoStringWithoutTimezone() throws {
    let key = uniqueKey("created")
    try store(.string("2026-06-03T09:30:00"), at: key)

    let out = try parseTextFromText("{formatDatetime(\(key), \"h:mm a\")}")

    XCTAssertEqual(out.value, "9:30 AM")
  }

  func testFormatDataOrToStringCanUseFormatDatetimeWithDatum() throws {
    let out = try EVY.formatDataOrToString(
      json: .string("2026-06-03T09:30:00"),
      format: "{formatDatetime($datum, \"HH:mm\")}"
    )

    XCTAssertEqual(out, "09:30")
  }

  func testGetForBindingDoesNotResolveSingularPluralFallback() throws {
    let id = UUID().uuidString
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    let resourceKey = "\(randomId)_things"
    let entityKey = "\(randomId)_thing"

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Plural resource item"),
        ])
      ]),
      at: "\(EVYNamespace.marketplace):\(resourceKey)"
    )

    XCTAssertThrowsError(try EVY.publicStore.getJsonForBinding(key: entityKey))
  }

  func testSingularQueryKeyDoesNotResolvePluralSyncedCollection() throws {
    let id = UUID().uuidString
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    let resourceKey = "\(randomId)_items"
    let entityKey = "\(randomId)_item"

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected singular item"),
        ])
      ]),
      at: "\(EVYNamespace.marketplace):\(resourceKey)"
    )

    EVY.resolveQueryParams([entityKey: [id]])

    XCTAssertEqual(try EVY.getDataFromText("{\(entityKey)}"), .string(id))
  }

  func testExactLocalKeyIsReadWithoutSyncedFallback() throws {
    let id = UUID().uuidString
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    let resourceKey = "\(randomId)_items"
    let entityKey = "\(randomId)_item"

    try store(
      .dictionary([
        "id": .string(id),
        "title": .string("Local item"),
      ]),
      at: entityKey
    )

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Synced collection item"),
        ])
      ]),
      at: "\(EVYNamespace.marketplace):\(resourceKey)"
    )

    XCTAssertEqual(
      try EVY.getDataFromText("{\(entityKey).title}"),
      .string("Local item")
    )
  }

  func testFindFirstReturnsMatchingDatumField() throws {
    let conditionsKey = uniqueKey("conditions")
    let itemKey = uniqueKey("item")
    let conditionId = UUID().uuidString

    try store(
      .array([
        .dictionary(["id": .string(conditionId), "value": .string("Excellent")]),
        .dictionary(["id": .string(UUID().uuidString), "value": .string("Other")]),
      ]),
      at: "\(EVYNamespace.marketplace):\(conditionsKey)"
    )
    try store(.dictionary(["condition_id": .string(conditionId)]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(conditionsKey), \(itemKey).condition_id).value}")

    XCTAssertEqual(result.value, "Excellent")
  }

  func testFindFirstReturnsEmptyForNoMatch() throws {
    let conditionsKey = uniqueKey("conditions")
    let itemKey = uniqueKey("item")

    try store(
      .array([.dictionary(["id": .string("abc"), "value": .string("Excellent")])]),
      at: "\(EVYNamespace.marketplace):\(conditionsKey)"
    )
    try store(.dictionary(["condition_id": .string("no_match")]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(conditionsKey), \(itemKey).condition_id).value}")

    XCTAssertEqual(result.value, "")
  }

  func testFindFirstDoesNotMutateStore() throws {
    let conditionsKey = uniqueKey("conditions")
    let itemKey = uniqueKey("item")
    let conditionId = UUID().uuidString

    try store(
      .array([.dictionary(["id": .string(conditionId), "value": .string("Good")])]),
      at: "\(EVYNamespace.marketplace):\(conditionsKey)"
    )
    try store(.dictionary(["condition_id": .string(conditionId)]), at: itemKey)

    let countBefore = try EVY.publicStore.getAll().count
    let result = try parseTextFromText(
      "{findFirst(\(conditionsKey), \(itemKey).condition_id).value}")
    let countAfter = try EVY.publicStore.getAll().count

    XCTAssertEqual(result.value, "Good")
    XCTAssertEqual(countBefore, countAfter)
  }

  func testFindFirstMultiPairReturnsActiveRequestWhenArchivedComesFirst() throws {
    let requestsKey = uniqueKey("requests")
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    let archivedId = UUID().uuidString
    let activeId = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(archivedId),
          "item_id": .string(itemId),
          "archived": .bool(true),
          "type": .string("pickup"),
        ]),
        .dictionary([
          "id": .string(activeId),
          "item_id": .string(itemId),
          "archived": .bool(false),
          "type": .string("pickup"),
        ]),
      ]),
      at: "\(EVYNamespace.marketplace):\(requestsKey)"
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(requestsKey), \(itemKey).id, item_id, false, archived).id}")

    XCTAssertEqual(result.value, activeId)
  }

  func testFindFirstMultiPairReturnsEmptyWhenOnlyArchivedExist() throws {
    let requestsKey = uniqueKey("requests")
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(UUID().uuidString),
          "item_id": .string(itemId),
          "archived": .bool(true),
          "type": .string("pickup"),
        ])
      ]),
      at: "\(EVYNamespace.marketplace):\(requestsKey)"
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(requestsKey), \(itemKey).id, item_id, false, archived).id}")

    XCTAssertEqual(result.value, "")
  }

  func testHasActiveRequestVisibilityExpression() throws {
    let requestsKey = uniqueKey("requests")
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(UUID().uuidString),
          "item_id": .string(itemId),
          "archived": .bool(false),
          "type": .string("pickup"),
        ])
      ]),
      at: "\(EVYNamespace.marketplace):\(requestsKey)"
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let hasActive =
      "{findFirst(\(requestsKey), \(itemKey).id, item_id, false, archived).item_id == \(itemKey).id}"
    let noActive =
      "{findFirst(\(requestsKey), \(itemKey).id, item_id, false, archived).item_id != \(itemKey).id}"

    XCTAssertTrue(try EVY.evaluateFromText(hasActive))
    XCTAssertFalse(try EVY.evaluateFromText(noActive))
  }

  func testFindFirstTwoArgStillMatchesByIdentifier() throws {
    let conditionsKey = uniqueKey("conditions")
    let conditionId = UUID().uuidString

    try store(
      .array([.dictionary(["id": .string(conditionId), "value": .string("Good")])]),
      at: "\(EVYNamespace.marketplace):\(conditionsKey)"
    )

    let result = try parseTextFromText("{findFirst(\(conditionsKey), \(conditionId)).value}")

    XCTAssertEqual(result.value, "Good")
  }

  func testFindFirstMultiPairWatchTargetsIncludeCollectionKey() throws {
    let requestsKey = uniqueKey("requests")
    let itemKey = uniqueKey("item")
    let expression =
      "{findFirst(\(requestsKey), \(itemKey).id, item_id, false, archived).item_id == \(itemKey).id}"

    let targets = EVY.watchTargets(for: expression)

    XCTAssertTrue(targets.contains(requestsKey))
    XCTAssertTrue(targets.contains("\(itemKey).id"))
  }

  func testRawDataFromPlainSourceExpression() throws {
    let key = uniqueKey("title")
    try store(.string("Hello world"), at: key)

    let raw = try _rawDataFromSource("{\(key)}")
    XCTAssertEqual(raw, .string("Hello world"))
  }

  func testDisplayTextFromFormattedSourceExpression() throws {
    let key = uniqueKey("price")
    try store(.dictionary(["value": .string("99"), "currency": .string("AUD")]), at: key)

    let display = EVY.displayText(fromSource: "{formatCurrency(\(key))}")
    XCTAssertEqual(display, "$99.00")
  }

  func testFormatAddress() throws {
    let cases:
      [(name: String, removing: [String], overrides: [String: EVYJson], expected: String)] = [
        ("complete", [], [:], "C509 28 Rothschild Avenue, 2018 Rosebery NSW"),
        ("omits missing unit", ["unit"], [:], "28 Rothschild Avenue, 2018 Rosebery NSW"),
        (
          "omits whitespace-only unit", [], ["unit": .string("   ")],
          "28 Rothschild Avenue, 2018 Rosebery NSW"
        ),
        ("omits missing postcode", ["postcode"], [:], "C509 28 Rothschild Avenue, Rosebery NSW"),
        ("omits missing city", ["city"], [:], "C509 28 Rothschild Avenue, 2018 NSW"),
        ("omits missing state", ["state"], [:], "C509 28 Rothschild Avenue, 2018 Rosebery"),
        (
          "sparse street and city only", ["unit", "postcode", "state"], [:],
          "28 Rothschild Avenue, Rosebery"
        ),
        ("no populated display fields", ["unit", "street", "postcode", "city", "state"], [:], ""),
      ]

    for testCase in cases {
      let key = try storeAddress(overrides: testCase.overrides, removing: testCase.removing)
      let out = try parseTextFromText("{formatAddress(\(key))}")
      XCTAssertEqual(out.value, testCase.expected, testCase.name)
    }
  }

  func testFormatAddressLine1() throws {
    let cases:
      [(name: String, removing: [String], overrides: [String: EVYJson], expected: String)] = [
        ("complete", [], [:], "C509 28 Rothschild Avenue, 2018"),
        ("omits missing unit", ["unit"], [:], "28 Rothschild Avenue, 2018"),
        ("omits missing postcode", ["postcode"], [:], "C509 28 Rothschild Avenue"),
      ]

    for testCase in cases {
      let key = try storeAddress(overrides: testCase.overrides, removing: testCase.removing)
      let out = try parseTextFromText("{formatAddressLine1(\(key))}")
      XCTAssertEqual(out.value, testCase.expected, testCase.name)
    }
  }

  func testFormatAddressLine2() throws {
    let cases:
      [(name: String, removing: [String], overrides: [String: EVYJson], expected: String)] = [
        ("complete", [], [:], "Rosebery, NSW"),
        ("omits missing city", ["city"], [:], "NSW"),
        ("omits missing state", ["state"], [:], "Rosebery"),
      ]

    for testCase in cases {
      let key = try storeAddress(overrides: testCase.overrides, removing: testCase.removing)
      let out = try parseTextFromText("{formatAddressLine2(\(key))}")
      XCTAssertEqual(out.value, testCase.expected, testCase.name)
    }
  }

  func testDisplayTextForDatumValueTemplatePreservesRawDatum() throws {
    let datum = EVYJson.dictionary(["price": .int(99), "currency": .string("AUD")])
    let display = try EVY.displayText(
      forDatum: datum,
      valueTemplate: "{formatCurrency($datum.price)}"
    )
    XCTAssertEqual(display, "$99.00")
    XCTAssertEqual(datum, EVYJson.dictionary(["price": .int(99), "currency": .string("AUD")]))
  }

  private func storeAddress(
    overrides: [String: EVYJson] = [:],
    removing keys: [String] = []
  ) throws -> String {
    var address: [String: EVYJson] = [
      "unit": .string("C509"),
      "street": .string("28 Rothschild Avenue"),
      "postcode": .string("2018"),
      "city": .string("Rosebery"),
      "state": .string("NSW"),
    ]
    for key in keys {
      address.removeValue(forKey: key)
    }
    for (key, value) in overrides {
      address[key] = value
    }
    let key = uniqueKey("address")
    try store(.dictionary(address), at: key)
    return key
  }

  private func storeDimensions(width: Int, height: Int) throws -> String {
    let key = uniqueKey("item")
    try store(
      .dictionary([
        "dimensions": .dictionary([
          "width": .int(width),
          "height": .int(height),
        ])
      ]),
      at: key)
    return key
  }

  private func store(_ value: EVYJson, at key: String) throws {
    let encodedValue = try JSONEncoder().encode(value)

    let parts = key.split(separator: ":", maxSplits: 2).map(String.init)
    if parts.count == 2 {
      let namespace = parts[0]
      let resource = parts[1]
      try EVY.publicStore.applySyncedValue(namespace: namespace, resource: resource, value: value)
      return
    }

    try EVY.publicStore.create(
      namespace: EVYNamespace.local, resource: key, id: EVYNamespace.singletonId,
      value: encodedValue)
  }

  private func uniqueKey(_ suffix: String) -> String {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    return "evy_interpreter_tests_\(suffix)_\(randomId)"
  }
}
