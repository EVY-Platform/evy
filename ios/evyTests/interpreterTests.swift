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
    try evySeedStandardFormattersForTests()
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

  func testIfSelectsSubtitleSuffixOnlyWhenPhotoListIsEmpty() throws {
    let key = uniqueKey("photo_ids")
    let template =
      "{count(\(key))}/10{if(count(\(key)) == 0, \" - Choose your listing's main photo first.\", \"\")}"

    try store(.array([]), at: key)
    XCTAssertEqual(
      try parseTextFromText(template).value,
      "0/10 - Choose your listing's main photo first.")

    let encoded = try JSONEncoder().encode(EVYJson.array([.string("photo-1")]))
    if let existing = try EVY.publicStore.getAll().first(where: { $0.resource == key }) {
      existing.data = encoded
    }
    XCTAssertEqual(try parseTextFromText(template).value, "1/10")
  }

  func testWatchTargetsIgnoresLiteralFunctionArguments() {
    XCTAssertEqual(
      EVY.watchTargets(for: "{formatDecimal(item.price, 2)}"),
      ["item.price"]
    )
  }

  func testWatchTargetsExtractsQuotedFormatDatetimeInLabel() {
    XCTAssertEqual(
      EVY.watchTargets(
        for: "Request {formatDatetime(selected_pickup_timeslot, \"HH:mm\")}"),
      ["selected_pickup_timeslot"]
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

  func testCountAndLengthReturnZeroForMissingPaths() throws {
    XCTAssertTrue(try EVY.evaluateFromText("{length(missing_draft_key) == 0}"))
    XCTAssertTrue(try EVY.evaluateFromText("{count(missing_draft_key) == 0}"))

    let itemKey = uniqueKey("item")
    try store(
      .dictionary([
        "transfer_options": .dictionary([
          "pickup": .dictionary([:])
        ])
      ]),
      at: itemKey
    )
    XCTAssertTrue(
      try EVY.evaluateFromText(
        "{length(\(itemKey).transfer_options.pickup.address_id) == 0}"))

    let nullKey = uniqueKey("null_value")
    try store(.null, at: nullKey)
    XCTAssertTrue(try EVY.evaluateFromText("{length(\(nullKey)) == 0}"))
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

  func testGetValueFromTextEvaluatesCompoundDimensionLabelsInSingleBraceBlock() throws {
    let key = uniqueKey("item")
    try store(
      .dictionary([
        "dimensions": .dictionary([
          "width": .int(500),
          "height": .int(300),
          "length": .int(200),
        ])
      ]),
      at: key)
    XCTAssertEqual(
      try EVY.getValueFromText(
        "{formatDimension(\(key).dimensions.width) (w) x formatDimension(\(key).dimensions.height) (h) x formatDimension(\(key).dimensions.length) (l)}"
      ).toString(),
      "50cm (w) x 30cm (h) x 20cm (l)"
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
    let entityRef = "\(MarketplaceTestFixture.service).\(entityKey)"
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
      at: entityRef
    )

    EVY.resolveQueryParams([entityRef: [secondId]])

    XCTAssertEqual(try EVY.getDataFromText("{\(entityRef).title}"), .string("Selected item"))

    EVY.resolveQueryParams([entityRef: [firstId, secondId]])
    XCTAssertEqual(try EVY.getDataFromText("{\(entityRef).title}"), .string("First item"))
  }

  func testResolveQueryParamsRefreshesStatesWhenSelectedEntityChanges() throws {
    let entityKey = uniqueKey("entities")
    let entityRef = "\(MarketplaceTestFixture.service).\(entityKey)"
    let firstId = UUID().uuidString
    let secondId = UUID().uuidString
    let firstAddressId = UUID().uuidString
    let secondAddressId = UUID().uuidString
    let firstAddress = EVYJson.dictionary([
      "id": .string(firstAddressId),
      "street": .string("1 First Street"),
      "latitude": .decimal(-33.86),
      "longitude": .decimal(151.20),
    ])
    let secondAddress = EVYJson.dictionary([
      "id": .string(secondAddressId),
      "street": .string("28 Rothschild Avenue"),
      "latitude": .decimal(-33.9135576),
      "longitude": .decimal(151.2052514),
    ])

    try store(
      .array([firstAddress, secondAddress]),
      at: EVYCoreResource.addresses.ref
    )
    try store(
      .array([
        .dictionary([
          "id": .string(firstId),
          "pickup_selection": .array([.string("2026-07-19T07:00:00")]),
          "delivery_selection": .array([.string("2026-07-21T07:00:00")]),
          "transfer_options": .dictionary([
            "pickup": .dictionary(["address_id": .string(firstAddressId)])
          ]),
        ]),
        .dictionary([
          "id": .string(secondId),
          "pickup_selection": .array([.string("2026-07-20T07:00:00")]),
          "delivery_selection": .array([.string("2026-07-22T07:00:00")]),
          "transfer_options": .dictionary([
            "pickup": .dictionary(["address_id": .string(secondAddressId)])
          ]),
        ]),
      ]),
      at: entityRef
    )
    let pickupSelections = EVYState<[String]>(
      watches: ["{\(entityRef).pickup_selection}"],
      setter: { EVYDatetime.readTimeslots("{\(entityRef).pickup_selection}") }
    )
    let deliverySelections = EVYState<[String]>(
      watches: ["{\(entityRef).delivery_selection}"],
      setter: { EVYDatetime.readTimeslots("{\(entityRef).delivery_selection}") }
    )
    let pickupAddressExpression =
      "{findFirst(\(EVYCoreResource.addresses.ref), \(entityRef).transfer_options.pickup.address_id)}"
    let pickupAddress = EVYState<EVYJson>(
      watches: EVY.watchTargets(for: pickupAddressExpression),
      setter: {
        (try? EVY.getDataFromText(pickupAddressExpression)) ?? .null
      }
    )

    XCTAssertTrue(pickupSelections.value.isEmpty)
    XCTAssertTrue(deliverySelections.value.isEmpty)
    XCTAssertNotEqual(pickupAddress.value, secondAddress)

    EVY.cacheQueryParams([EVY.entityIdQueryKey: [secondId]], forPageId: testPageId)

    XCTAssertEqual(pickupSelections.value, ["2026-07-20T07:00:00"])
    XCTAssertEqual(deliverySelections.value, ["2026-07-22T07:00:00"])
    XCTAssertEqual(pickupAddress.value, secondAddress)
  }

  func testResolveQueryParamsDoesNotCacheSingularAlias() throws {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_").lowercased()
    let resourceKey = "evy_interpreter_tests_\(randomId)_items"
    let entityKey = "evy_interpreter_tests_\(randomId)_item"
    let resourceRef = "\(MarketplaceTestFixture.service).\(resourceKey)"
    let entityRef = "\(MarketplaceTestFixture.service).\(entityKey)"
    let id = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected exact item"),
        ])
      ]),
      at: resourceRef
    )

    EVY.resolveQueryParams([resourceRef: [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(resourceRef).title}"),
      .string("Selected exact item")
    )
    XCTAssertThrowsError(try EVY.getDataFromText("{\(entityRef).title}"))
  }

  func testResolveQueryParamsResolvesExplicitResourceRef() throws {
    let itemsRef = "\(MarketplaceTestFixture.service).\(uniqueKey("test_svc_items"))"
    let id = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected from explicit ref"),
        ])
      ]),
      at: itemsRef
    )

    EVY.resolveQueryParams([itemsRef: [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(itemsRef).title}"), .string("Selected from explicit ref"))
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

  func testCollectionResolvesFromPinnedScopeNotGlobalScope() throws {
    let itemsKey = uniqueKey("items")
    let itemsRef = "\(MarketplaceTestFixture.service).\(itemsKey)"
    let homePageId = "home-\(UUID().uuidString)"
    let detailPageId = "detail-\(UUID().uuidString)"

    let item1 = EVYJson.dictionary(["id": .string("id-1"), "title": .string("Item 1")])
    let item2 = EVYJson.dictionary(["id": .string("id-2"), "title": .string("Item 2")])
    try EVY.publicStore.applySyncedValue(
      namespace: MarketplaceTestFixture.service, resource: itemsRef,
      value: .array([item1, item2]))

    let encoded = try JSONEncoder().encode(item1)
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: detailPageId, id: itemsRef, value: encoded)

    EVY.activeCacheScopeId = detailPageId
    let resultOnDetail = try EVY.getDataFromText("{\(itemsRef)}")
    XCTAssertEqual(resultOnDetail, item1, "Detail page scope resolves to single cached item")

    EVY.activeCacheScopeId = homePageId
    let resultOnHome = try EVY.getDataFromText("{\(itemsRef)}")
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

  func testEnsureDraftExistsDoesNotShadowCachedDottedResourceRef() throws {
    let itemsRef = "\(MarketplaceTestFixture.service).\(uniqueKey("items"))"
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: testPageId)
    EVY.draftStore.activeScopeId = scopeId

    let item = EVYJson.dictionary(["id": .string("id-1"), "title": .string("Selected title")])
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache,
      resource: testPageId,
      id: itemsRef,
      value: try JSONEncoder().encode(item)
    )

    EVY.ensureDraftExists(variableName: "\(itemsRef).title", scopeId: scopeId)

    let binding = try EVY.draftStore.binding(
      fromParsedProps: "\(itemsRef).title", scopeId: scopeId)
    XCTAssertNil(
      EVY.draftStore.draftIfPresent(binding: binding),
      "Bootstrap must not create an empty draft over a navigate-query cached entity")
    XCTAssertEqual(try EVY.getDataFromText("{\(itemsRef).title}"), .string("Selected title"))
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

  func testResolveQueryParamsResolvesGenericIdFromSyncedCollection() throws {
    let entityKey = uniqueKey("entities")
    let entityRef = "\(MarketplaceTestFixture.service).\(entityKey)"
    let id = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected by generic id"),
        ])
      ]),
      at: entityRef
    )

    EVY.resolveQueryParams(["id": [id]])

    XCTAssertEqual(
      try EVY.getDataFromText("{\(entityRef).title}"),
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

  func testSortScalarDescendingReversesOrder() throws {
    let key = uniqueKey("times")
    try store(
      .array([
        .string("2026-06-03T09:00:00"),
        .string("2026-06-04T09:30:00"),
      ]),
      at: key
    )

    let latest = try parseTextFromText("{findFirst(sort(\(key), desc))}")
    XCTAssertEqual(latest.value, "2026-06-04T09:30:00")
  }

  func testSortNumericAscendingUsesNumericComparison() throws {
    let key = uniqueKey("amounts")
    try store(
      .array([
        .int(150),
        .int(9),
        .int(42),
      ]),
      at: key
    )

    let smallest = try parseTextFromText("{findFirst(sort(\(key), asc))}")
    XCTAssertEqual(smallest.value, "9")
  }

  func testSortKeyedRecordsIsStableForEqualKeys() throws {
    let key = uniqueKey("records")
    try store(
      .array([
        .dictionary(["id": .string("first"), "rank": .int(1)]),
        .dictionary(["id": .string("second"), "rank": .int(1)]),
      ]),
      at: key
    )

    let first = try parseTextFromText("{findFirst(sort(\(key), asc, rank)).id}")
    XCTAssertEqual(first.value, "first")
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
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_").lowercased()
    let resourceKey = "\(randomId)_things"
    let entityKey = "\(randomId)_thing"

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Plural resource item"),
        ])
      ]),
      at: "\(MarketplaceTestFixture.service).\(resourceKey)"
    )

    XCTAssertThrowsError(
      try EVY.publicStore.getJsonForBinding(key: entityKey, cacheScopeId: nil))
  }

  func testSingularQueryKeyDoesNotResolvePluralSyncedCollection() throws {
    let id = UUID().uuidString
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_").lowercased()
    let resourceKey = "\(randomId)_items"
    let entityKey = "\(randomId)_item"

    try store(
      .array([
        .dictionary([
          "id": .string(id),
          "title": .string("Selected singular item"),
        ])
      ]),
      at: "\(MarketplaceTestFixture.service).\(resourceKey)"
    )

    EVY.resolveQueryParams([entityKey: [id]])

    XCTAssertEqual(try EVY.getDataFromText("{\(entityKey)}"), .string(id))
  }

  func testExactLocalKeyIsReadWithoutSyncedFallback() throws {
    let id = UUID().uuidString
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_").lowercased()
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
      at: "\(MarketplaceTestFixture.service).\(resourceKey)"
    )

    XCTAssertEqual(
      try EVY.getDataFromText("{\(entityKey).title}"),
      .string("Local item")
    )
  }

  func testFindFirstReturnsMatchingDatumField() throws {
    let conditionsKey = uniqueKey("conditions")
    let conditionsRef = "\(MarketplaceTestFixture.service).\(conditionsKey)"
    let itemKey = uniqueKey("item")
    let conditionId = UUID().uuidString

    try store(
      .array([
        .dictionary(["id": .string(conditionId), "value": .string("Excellent")]),
        .dictionary(["id": .string(UUID().uuidString), "value": .string("Other")]),
      ]),
      at: conditionsRef
    )
    try store(.dictionary(["condition_id": .string(conditionId)]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(conditionsRef), \(itemKey).condition_id).value}")

    XCTAssertEqual(result.value, "Excellent")
  }

  func testFindFirstReturnsEmptyForNoMatch() throws {
    let conditionsKey = uniqueKey("conditions")
    let conditionsRef = "\(MarketplaceTestFixture.service).\(conditionsKey)"
    let itemKey = uniqueKey("item")

    try store(
      .array([.dictionary(["id": .string("abc"), "value": .string("Excellent")])]),
      at: conditionsRef
    )
    try store(.dictionary(["condition_id": .string("no_match")]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(conditionsRef), \(itemKey).condition_id).value}")

    XCTAssertEqual(result.value, "")
  }

  func testFindFirstDoesNotMutateStore() throws {
    let conditionsKey = uniqueKey("conditions")
    let conditionsRef = "\(MarketplaceTestFixture.service).\(conditionsKey)"
    let itemKey = uniqueKey("item")
    let conditionId = UUID().uuidString

    try store(
      .array([.dictionary(["id": .string(conditionId), "value": .string("Good")])]),
      at: conditionsRef
    )
    try store(.dictionary(["condition_id": .string(conditionId)]), at: itemKey)

    let countBefore = try EVY.publicStore.getAll().count
    let result = try parseTextFromText(
      "{findFirst(\(conditionsRef), \(itemKey).condition_id).value}")
    let countAfter = try EVY.publicStore.getAll().count

    XCTAssertEqual(result.value, "Good")
    XCTAssertEqual(countBefore, countAfter)
  }

  func testFindFirstExpressionReturnsUnansweredMessageWhenAnswerComesFirst() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    let answerId = UUID().uuidString
    let requestId = UUID().uuidString

    try store(
      .array([
        // The answer is stored first, so a null test is the only thing that can skip it.
        EVYTestMessageFixtures.message(
          id: answerId,
          fk: itemId,
          type: "pickup",
          value: "accept",
          parent_message_id: requestId
        ),
        EVYTestMessageFixtures.message(
          id: requestId,
          fk: itemId,
          type: "pickup",
          value: "pending"
        ),
      ]),
      at: messagesRef
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(messagesRef), fk == \(itemKey).id && parent_message_id == null).id}")

    XCTAssertEqual(result.value, requestId)
  }

  func testFindFirstExpressionFiltersByUnquotedLiteralValue() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    let messageId = UUID().uuidString

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: messageId,
          fk: itemId,
          type: "pickup",
          value: "accept",
          time: "2026-06-03T09:00:00"
        )
      ]),
      at: messagesRef
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let pendingResult = try parseTextFromText(
      "{findFirst(\(messagesRef), fk == \(itemKey).id && value == pending).id}"
    )
    let acceptedResult = try parseTextFromText(
      "{findFirst(\(messagesRef), fk == \(itemKey).id && value == accept).id}"
    )

    XCTAssertEqual(pendingResult.value, "")
    XCTAssertEqual(acceptedResult.value, messageId)
  }

  func testFormatDatetimeOverFindFirstPath() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: UUID().uuidString,
          fk: itemId,
          type: "pickup",
          value: "accept",
          time: "2026-06-03T09:00:00"
        )
      ]),
      at: messagesRef
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let acceptedFindFirst =
      "findFirst(\(messagesRef), fk == \(itemKey).id && value == accept)"
    let day = try parseTextFromText(
      "{formatDatetime(\(acceptedFindFirst).data.time, \"EEE do\")}")
    let time = try parseTextFromText(
      "{formatDatetime(\(acceptedFindFirst).data.time, \"HH:mm\")}")

    XCTAssertEqual(day.value, "Wed 3rd")
    XCTAssertEqual(time.value, "09:00")
  }

  func testStatusExpressionWatchTargetsIncludeCollectionKey() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let expression =
      "{findFirst(\(messagesRef), fk == \(itemKey).id && value == pending).fk == \(itemKey).id}"

    let targets = EVY.watchTargets(for: expression)

    XCTAssertTrue(targets.contains(messagesRef))
    XCTAssertTrue(targets.contains("\(itemKey).id"))
  }

  func testFilterReturnsAllMatchingCandidates() throws {
    let key = uniqueKey("rows")
    let matchA = UUID().uuidString
    let matchB = UUID().uuidString
    try store(
      .array([
        .dictionary(["id": .string(matchA), "status": .string("pending")]),
        .dictionary(["id": .string(UUID().uuidString), "status": .string("accept")]),
        .dictionary(["id": .string(matchB), "status": .string("pending")]),
      ]),
      at: key
    )

    let filtered = try EVY.getDataFromText("{filter(\(key), $datum.status == pending)}")
    guard case .array(let items) = filtered else {
      return XCTFail("filter should return an array")
    }
    XCTAssertEqual(items.map { $0.identifierValue() }.sorted(), [matchA, matchB].sorted())
  }

  func testFilterBindsCandidateAsDatum() throws {
    let key = uniqueKey("rows")
    let matchId = UUID().uuidString
    try store(
      .array([
        .dictionary(["id": .string(matchId), "label": .string("keep")]),
        .dictionary(["id": .string(UUID().uuidString), "label": .string("drop")]),
      ]),
      at: key
    )

    let result = try parseTextFromText("{filter(\(key), $datum.label == keep).0.id}")
    XCTAssertEqual(result.value, matchId)
  }

  func testFilterNestedFindFirstResolvesOuterDatumAndInnerBareFields() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemId = UUID().uuidString
    let openRequestId = UUID().uuidString
    let answeredRequestId = UUID().uuidString
    let responseId = UUID().uuidString

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: answeredRequestId, fk: itemId, created_at: "2026-06-01T00:00:00.000Z",
          type: "pickup", value: "pending"),
        EVYTestMessageFixtures.message(
          id: responseId, fk: itemId, created_at: "2026-06-01T00:01:00.000Z",
          type: "pickup", value: "accept", parent_message_id: answeredRequestId,
          time: "2026-06-03T09:00:00"),
        EVYTestMessageFixtures.message(
          id: openRequestId, fk: itemId, created_at: "2026-06-01T00:02:00.000Z",
          type: "delivery", value: "pending", time: "2026-06-04T10:00:00"),
      ]),
      at: messagesRef
    )

    let filtered = try EVY.getDataFromText(
      """
      {filter(\(messagesRef), $datum.value == pending && findFirst(sort(\(messagesRef), desc, created_at), fk == $datum.fk && type == $datum.type).id == $datum.id)}
      """
    )
    guard case .array(let items) = filtered else {
      return XCTFail("filter should return an array")
    }
    XCTAssertEqual(items.map { $0.identifierValue() }, [openRequestId])
  }

  func testFilterReturnsEmptyArrayWhenNothingMatches() throws {
    let key = uniqueKey("rows")
    try store(
      .array([
        .dictionary(["id": .string(UUID().uuidString), "status": .string("accept")])
      ]),
      at: key
    )

    let filtered = try EVY.getDataFromText("{filter(\(key), $datum.status == pending)}")
    guard case .array(let items) = filtered else {
      return XCTFail("filter should return an array")
    }
    XCTAssertTrue(items.isEmpty)
  }

  /// D4 sold-filter: a `findFirst` miss on status history must make `!= "sold"` true so items
  /// with no status rows still appear in search.
  func testFilterFindFirstMissNotEqualSoldIncludesItemWithoutStatusHistory() throws {
    let itemsRef = MarketplaceTestFixture.itemsRef
    let statusesRef = MarketplaceTestFixture.statusesRef
    let availableItemId = UUID().uuidString
    let soldItemId = UUID().uuidString
    let pendingItemId = UUID().uuidString

    try store(
      .array([
        .dictionary(["id": .string(availableItemId), "title": .string("No status yet")]),
        .dictionary(["id": .string(soldItemId), "title": .string("Sold item")]),
        .dictionary(["id": .string(pendingItemId), "title": .string("Pickup pending")]),
      ]),
      at: itemsRef
    )
    try store(
      .array([
        .dictionary([
          "id": .string(UUID().uuidString),
          "item_id": .string(soldItemId),
          "status": .string("sold"),
          "created_at": .string("2026-06-01T00:00:00.000Z"),
        ]),
        .dictionary([
          "id": .string(UUID().uuidString),
          "item_id": .string(pendingItemId),
          "status": .string("pickup_pending"),
          "created_at": .string("2026-06-01T00:00:00.000Z"),
        ]),
      ]),
      at: statusesRef
    )

    let filtered = try EVY.getDataFromText(
      """
      {filter(\(itemsRef), findFirst(sort(\(statusesRef), desc, created_at), item_id == $datum.id).status != "sold")}
      """
    )
    guard case .array(let items) = filtered else {
      return XCTFail("filter should return an array")
    }

    XCTAssertEqual(
      Set(items.compactMap { $0.identifierValue() }),
      Set([availableItemId, pendingItemId]),
      "absent status history and non-sold statuses should pass the sold filter"
    )
  }

  func testFilterRejectsNonCollectionInput() throws {
    let key = uniqueKey("scalar")
    try store(.string("not-a-collection"), at: key)

    XCTAssertThrowsError(try EVY.getDataFromText("{filter(\(key), $datum == x)}"))
  }

  func testFilterWatchTargetsIncludeCollectionKey() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let expression =
      "{filter(\(messagesRef), $datum.value == pending)}"

    let targets = EVY.watchTargets(for: expression)

    XCTAssertTrue(targets.contains(messagesRef))
  }

  func testOwnsReturnsTrueAfterRecordOwnership() throws {
    EVYOwnershipLedger.reset()
    defer { EVYOwnershipLedger.reset() }

    let resource = MarketplaceTestFixture.itemsRef
    let id = UUID().uuidString
    EVY.recordOwnership(resource: resource, id: id)

    XCTAssertTrue(try EVY.evaluateFromText("{owns(\(resource), \(id)) == true}"))
    XCTAssertFalse(
      try EVY.evaluateFromText("{owns(\(resource), \(UUID().uuidString)) == true}"))
    XCTAssertTrue(
      try EVY.evaluateFromText("{owns(\(resource), \(UUID().uuidString)) == false}"))
  }

  func testOwnsResolvesDatumArgsInsideFilter() throws {
    EVYOwnershipLedger.reset()
    defer { EVYOwnershipLedger.reset() }

    let messagesRef = EVYCoreResource.messages.ref
    let itemId = UUID().uuidString
    let otherItemId = UUID().uuidString
    let ownedRequestId = UUID().uuidString
    let otherRequestId = UUID().uuidString
    let resource = MarketplaceTestFixture.itemsRef

    EVY.recordOwnership(resource: resource, id: itemId)

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: ownedRequestId, fk: itemId, resource: resource,
          created_at: "2026-06-01T00:00:00.000Z", type: "pickup", value: "pending"),
        EVYTestMessageFixtures.message(
          id: otherRequestId, fk: otherItemId, resource: resource,
          created_at: "2026-06-01T00:01:00.000Z", type: "pickup", value: "pending"),
      ]),
      at: messagesRef
    )

    let filtered = try EVY.getDataFromText(
      """
      {filter(\(messagesRef), owns($datum.resource, $datum.fk) == true)}
      """
    )
    guard case .array(let items) = filtered else {
      return XCTFail("filter should return an array")
    }
    XCTAssertEqual(items.map { $0.identifierValue() }, [ownedRequestId])
  }

  func testFilterForYouExpressionKeepsOnlyOpenOwnedRequest() throws {
    EVYOwnershipLedger.reset()
    defer { EVYOwnershipLedger.reset() }

    let messagesRef = EVYCoreResource.messages.ref
    let itemId = UUID().uuidString
    let openRequestId = UUID().uuidString
    let settledRequestId = UUID().uuidString
    let responseId = UUID().uuidString
    let resource = MarketplaceTestFixture.itemsRef

    EVY.recordOwnership(resource: resource, id: itemId)

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: settledRequestId, fk: itemId, resource: resource,
          created_at: "2026-06-01T00:00:00.000Z", type: "pickup", value: "pending"),
        EVYTestMessageFixtures.message(
          id: responseId, fk: itemId, resource: resource,
          created_at: "2026-06-01T00:01:00.000Z", type: "pickup", value: "accept",
          parent_message_id: settledRequestId, time: "2026-06-03T09:00:00"),
        EVYTestMessageFixtures.message(
          id: openRequestId, fk: itemId, resource: resource,
          created_at: "2026-06-01T00:02:00.000Z", type: "delivery", value: "pending",
          time: "2026-06-04T10:00:00"),
      ]),
      at: messagesRef
    )

    let filtered = try EVY.getDataFromText(
      """
      {filter(\(messagesRef), $datum.value == pending && owns($datum.resource, $datum.fk) == true && findFirst(sort(\(messagesRef), desc, created_at), fk == $datum.fk && type == $datum.type).id == $datum.id)}
      """
    )
    guard case .array(let items) = filtered else {
      return XCTFail("filter should return an array")
    }
    XCTAssertEqual(items.map { $0.identifierValue() }, [openRequestId])
  }

  func testNowFunctionReturnsPinnedClockISO8601() throws {
    let pinnedDate = Date(timeIntervalSince1970: 1_780_000_000)
    EVY.nowProvider = { pinnedDate }
    defer { EVY.nowProvider = { Date() } }

    let result = try parseTextFromText("{now()}")

    XCTAssertEqual(result.value, pinnedDate.ISO8601Format())
  }

  func testFindFirstTwoArgStillMatchesByIdentifier() throws {
    let conditionsKey = uniqueKey("conditions")
    let conditionsRef = "\(MarketplaceTestFixture.service).\(conditionsKey)"
    let conditionId = UUID().uuidString

    try store(
      .array([.dictionary(["id": .string(conditionId), "value": .string("Good")])]),
      at: conditionsRef
    )

    let result = try parseTextFromText("{findFirst(\(conditionsRef), \(conditionId)).value}")

    XCTAssertEqual(result.value, "Good")
  }

  func testFindFirstNotNullMatchesAnsweringRecord() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    let answerId = UUID().uuidString

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: answerId,
          fk: itemId,
          type: "pickup",
          value: "accept",
          parent_message_id: UUID().uuidString
        ),
        EVYTestMessageFixtures.message(
          id: UUID().uuidString,
          fk: itemId,
          type: "pickup",
          value: "pending"
        ),
      ]),
      at: messagesRef
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(messagesRef), fk == \(itemKey).id && parent_message_id != null).id}")

    XCTAssertEqual(result.value, answerId)
  }

  func testFindFirstOrExpressionMatchesEitherStatus() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    let acceptedId = UUID().uuidString

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: acceptedId,
          fk: itemId,
          type: "pickup",
          value: "accept"
        )
      ]),
      at: messagesRef
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let result = try parseTextFromText(
      "{findFirst(\(messagesRef), fk == \(itemKey).id && (value == pending || value == accept)).id}"
    )

    XCTAssertEqual(result.value, acceptedId)
  }

  // MARK: - The latest matching record

  /// `findFirst(sort(collection, desc, field), predicate)` is how the item page asks for "the
  /// latest message about this transfer method". Nesting a collection call inside `findFirst` is
  /// covered elsewhere, but only in the one-argument form - the combination with a predicate is
  /// what the item page's whole state machine rests on, so it is pinned here.
  ///
  /// Timestamps carry milliseconds on purpose. `evySort` breaks equal keys by original order
  /// regardless of direction, so second-resolution values would let the first-stored record win a
  /// `desc` sort - which is exactly backwards for "latest wins".
  private func storeTransferMessages(at key: String, itemId: String) throws -> (
    oldestPickup: String, newestPickup: String, delivery: String
  ) {
    let oldestPickup = UUID().uuidString
    let newestPickup = UUID().uuidString
    let delivery = UUID().uuidString

    try store(
      .array([
        // Deliberately stored oldest-first, so store order and sort order disagree.
        EVYTestMessageFixtures.message(
          id: oldestPickup, fk: itemId, created_at: "2026-06-01T09:00:00.100Z",
          type: "pickup", value: "pending"),
        EVYTestMessageFixtures.message(
          id: delivery, fk: itemId, created_at: "2026-06-01T09:00:00.200Z",
          type: "delivery", value: "pending"),
        EVYTestMessageFixtures.message(
          id: newestPickup, fk: itemId, created_at: "2026-06-01T09:00:00.300Z",
          type: "pickup", value: "accept", time: "2026-06-03T09:00:00"),
      ]),
      at: key
    )
    return (oldestPickup, newestPickup, delivery)
  }

  func testFindFirstOverDescendingSortReturnsNewestMatch() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    let ids = try storeTransferMessages(at: messagesRef, itemId: itemId)
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let latest = try parseTextFromText(
      "{findFirst(sort(\(messagesRef), desc, created_at), fk == \(itemKey).id && type == pickup).id}"
    )

    XCTAssertEqual(latest.value, ids.newestPickup, "the newest match wins, not the first stored")
  }

  /// The mirror image: same collection, same predicate, opposite direction. Proves the sort is
  /// what decides rather than anything about how the records happen to be stored.
  func testFindFirstOverAscendingSortReturnsOldestMatch() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    let ids = try storeTransferMessages(at: messagesRef, itemId: itemId)
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let oldest = try parseTextFromText(
      "{findFirst(sort(\(messagesRef), asc, created_at), fk == \(itemKey).id && type == pickup).id}"
    )

    XCTAssertEqual(oldest.value, ids.oldestPickup)
  }

  func testFindFirstOverSortReadsTheMatchedRecordsValue() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    _ = try storeTransferMessages(at: messagesRef, itemId: itemId)
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let latestPickup =
      "findFirst(sort(\(messagesRef), desc, created_at), fk == \(itemKey).id && type == pickup)"
    let latestDelivery =
      "findFirst(sort(\(messagesRef), desc, created_at), fk == \(itemKey).id && type == delivery)"

    XCTAssertTrue(try _evaluateFromText("{\(latestPickup).value == accept}"))
    XCTAssertFalse(try _evaluateFromText("{\(latestPickup).value == pending}"))
    // Each transfer method's state is independent of the others.
    XCTAssertTrue(try _evaluateFromText("{\(latestDelivery).value == pending}"))
  }

  /// The "nothing has happened yet" branch. A predicate that matches nothing yields an empty
  /// value, which compares unequal to every state - so "no messages", "rejected" and "cancelled"
  /// all fall through to the same branch without a rule of their own.
  func testFindFirstOverSortWithNoMatchIsNeitherPendingNorAccepted() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    _ = try storeTransferMessages(at: messagesRef, itemId: itemId)
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let latestShipping =
      "findFirst(sort(\(messagesRef), desc, created_at), fk == \(itemKey).id && type == shipping)"

    XCTAssertTrue(
      try _evaluateFromText(
        "{\(latestShipping).value != pending && \(latestShipping).value != accept}"))
  }

  /// `formatDatetime(findFirst(sort(…), …).data.time, "…")` is three functions deep, which is
  /// what the accepted-request confirmation row interpolates. The function-matching pattern
  /// only tolerated one level of nested parentheses, so this rendered as its own source text.
  func testFormatDatetimeOverFindFirstOverSortInterpolates() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString
    _ = try storeTransferMessages(at: messagesRef, itemId: itemId)
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    let latestPickup =
      "findFirst(sort(\(messagesRef), desc, created_at), fk == \(itemKey).id && type == pickup)"
    let rendered = try parseTextFromText(
      "Pickup confirmed for {formatDatetime(\(latestPickup).data.time, \"EEE do\")}")

    XCTAssertEqual(rendered.value, "Pickup confirmed for Wed 3rd")
  }

  func testFindFirstNestedRecordPathMatches() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let pickupId = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(UUID().uuidString),
          "type": .string("delivery"),
        ]),
        .dictionary([
          "id": .string(pickupId),
          "type": .string("pickup"),
        ]),
      ]),
      at: messagesRef
    )

    let result = try parseTextFromText(
      "{findFirst(\(messagesRef), type == pickup).id}")

    XCTAssertEqual(result.value, pickupId)
  }

  func testFindFirstNumericComparison() throws {
    let itemsKey = uniqueKey("priced")
    let itemsRef = "\(MarketplaceTestFixture.service).\(itemsKey)"
    let expensiveId = UUID().uuidString

    try store(
      .array([
        .dictionary([
          "id": .string(UUID().uuidString),
          "price": .int(50),
        ]),
        .dictionary([
          "id": .string(expensiveId),
          "price": .int(150),
        ]),
      ]),
      at: itemsRef
    )

    let result = try parseTextFromText("{findFirst(\(itemsRef), price > 100).id}")

    XCTAssertEqual(result.value, expensiveId)
  }

  func testFindFirstOldPairFormThrows() throws {
    let messagesRef = EVYCoreResource.messages.ref
    let itemKey = uniqueKey("item")
    let itemId = UUID().uuidString

    try store(
      .array([
        EVYTestMessageFixtures.message(
          id: UUID().uuidString,
          fk: itemId
        )
      ]),
      at: messagesRef
    )
    try store(.dictionary(["id": .string(itemId)]), at: itemKey)

    XCTAssertThrowsError(
      try parseTextFromText(
        "{findFirst(\(messagesRef), \(itemKey).id, fk, null, created_at).id}")
    )
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
        ("complete", [], [:], "C509 28 Rothschild Avenue"),
        ("omits missing unit", ["unit"], [:], "28 Rothschild Avenue"),
        ("omits missing street", ["street"], [:], "C509"),
        ("no street portion", ["unit", "street"], [:], ""),
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
        ("complete", [], [:], "Rosebery, NSW 2018"),
        ("omits missing city", ["city"], [:], "NSW 2018"),
        ("omits missing state", ["state"], [:], "Rosebery 2018"),
        ("omits missing postcode", ["postcode"], [:], "Rosebery, NSW"),
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
    try seedLocalBinding(key: key, value: value)
  }
}
