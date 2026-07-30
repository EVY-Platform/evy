//
//  EVYDraftBindingTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYDraftBindingTests: XCTestCase {
  override func tearDownWithError() throws {
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    if let pageId = EVY.activeCacheScopeId {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: pageId)
    }
    EVY.activeCacheScopeId = nil
    try super.tearDownWithError()
  }

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

  func testBindingPageLocalAliasOnEntityScopeUsesAliasFlat() throws {
    let itemsResource = MarketplaceTestFixture.itemsRef
    let scopeId = EVYDraft.createMergeScopeId(flowId: "create-flow", entityKey: itemsResource)
    let pageLocal = try EVYDraft.binding(parsedProps: "pickup_address", scopeId: scopeId)
    XCTAssertEqual(pageLocal.scopeId, scopeId)
    guard case .aliasFlat(let pageLocalSegs) = pageLocal.mergeMode else {
      return XCTFail("page-local pickup_address must be aliasFlat so create omits it")
    }
    XCTAssertEqual(pageLocalSegs, ["pickup_address"])

    let entityField = try EVYDraft.binding(
      parsedProps: "\(itemsResource).transfer_options.pickup.address_id",
      scopeId: scopeId
    )
    guard case .explicitPath(let entitySegs) = entityField.mergeMode else {
      return XCTFail("entity-prefixed paths must be explicitPath so create merges them")
    }
    XCTAssertEqual(entitySegs, ["transfer_options", "pickup", "address_id"])
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

  func testScopeEntityKey() {
    let uuid = "09f07052-c27c-4116-a508-a2bcb074c827"
    let cases: [(scopeId: String?, expected: String?)] = [
      ("flow:items", "items"),
      ("flow:browse", nil),
      ("app:unscoped", nil),
      ("ephemeral:\(uuid)", nil),
      (nil, nil),
      ("", nil),
      ("   ", nil),
      ("flow", nil),
      ("flow:", nil),
      (":item", nil),
    ]

    for testCase in cases {
      XCTAssertEqual(
        EVYDraft.Scope.entityKey(fromScopeId: testCase.scopeId),
        testCase.expected,
        "scopeId: \(String(describing: testCase.scopeId))"
      )
    }
  }

  func testScopeFlowId() {
    let uuid = "09f07052-c27c-4116-a508-a2bcb074c827"
    let cases: [(scopeId: String?, expected: String?)] = [
      ("flow-123:res-abc", "flow-123"),
      ("flow:with:colons:res", "flow:with:colons"),
      ("flow:browse", nil),
      ("app:unscoped", nil),
      ("ephemeral:\(uuid)", nil),
      (nil, nil),
      ("", nil),
      ("   ", nil),
      ("flow", nil),
      ("flow:", nil),
      (":item", nil),
    ]

    for testCase in cases {
      XCTAssertEqual(
        EVYDraft.Scope.flowId(fromScopeId: testCase.scopeId),
        testCase.expected,
        "scopeId: \(String(describing: testCase.scopeId))"
      )
    }
  }

  // MARK: - Ephemeral drafts

  func testEphemeralScopeIdForPageIdUsesEphemeralPrefix() {
    let pageId = UUID().uuidString
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: pageId)

    XCTAssertEqual(scopeId, "ephemeral:\(pageId)")
    XCTAssertNil(EVYDraft.Scope.entityKey(fromScopeId: scopeId))
  }

  func testDraftNotifyUpdatePostsAliasAndEntityPathNotifications() throws {
    let store = EVYDataStore(name: "draft-notify-test", inMemoryOnly: true)
    let draftStore = EVYDraftStore(dataStore: store)
    let binding = try EVYDraft.binding(parsedProps: "condition", scopeId: "flow:item")
    var notificationKeys: [String] = []
    let token = NotificationCenter.default.addObserver(
      forName: .evyValueChanged,
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
      forName: .evyValueChanged,
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

  func testWriteRawValueWritesDestinationObjectTemplate() throws {
    let key = uniqueKey("item_price")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId
    let destination = "{\(key): {value: $datum, currency: \"AUD\"}}"

    try EVY.writeRawStringValue("99", to: destination, scopeId: scopeId)

    let stored = try EVY.getDataFromText("{\(key)}")
    XCTAssertEqual(
      stored,
      .dictionary([
        "currency": .string("AUD"),
        "value": .int(99),
      ])
    )
  }

  func testWriteRawValueStillWritesPlainPathDestination() throws {
    let key = uniqueKey("item_title")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId

    try EVY.writeRawStringValue("Geo", to: "{\(key)}", scopeId: scopeId)

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("Geo"))
  }

  func testParseDestinationReturnsNilForPlainPath() throws {
    XCTAssertNil(try EVYObjectLiteral.parseDestination(from: "item.title"))
    XCTAssertNil(
      try EVYObjectLiteral.parseDestination(
        from: "\(MarketplaceTestFixture.itemsRef).title"))
  }

  func testEphemeralScopeSharesWriteThenReadWithoutSyncedBacking() throws {
    let variableName = "\(uniqueKey("item")).title"
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: UUID().uuidString)
    EVY.draftStore.activeScopeId = scopeId
    var notificationKeys: [String] = []
    let token = NotificationCenter.default.addObserver(
      forName: .evyValueChanged,
      object: nil,
      queue: .main
    ) { notification in
      if let key = notification.object as? String {
        notificationKeys.append(key)
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    try EVY.writeRawStringValue("Hello", to: "{\(variableName)}", scopeId: scopeId)

    XCTAssertEqual(try EVY.getDataFromText("{\(variableName)}"), .string("Hello"))
    XCTAssertTrue(notificationKeys.contains(variableName))
  }

  func testDestinationOnlyDisplayAndEditableTextReadDraftValueAfterWrite() throws {
    let key = uniqueKey("title")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId
    let destination = "{\(key)}"

    try EVY.writeRawStringValue("Persisted title", to: destination, scopeId: scopeId)

    XCTAssertEqual(
      EVY.displayText(fromSource: nil, destination: destination),
      "Persisted title"
    )
    XCTAssertEqual(
      EVY.editableText(fromSource: nil, destination: destination),
      "Persisted title"
    )
  }

  func testWriteRawValueCreatesPickupAddressLocalDraftOnBackingRow() throws {
    let scopeId = "flow:items"
    let pageId = "page_\(UUID().uuidString)"
    EVY.activeCacheScopeId = pageId
    EVY.draftStore.activeScopeId = scopeId

    let address = samplePickupAddress()
    try EVY.writeRawValue(
      address,
      to: "{pickup_address}",
      scopeId: scopeId
    )

    XCTAssertEqual(
      try EVY.getDataFromText("{pickup_address}"),
      address
    )
  }

  func testNestedPickupAddressPropsResolveFromParentDraft() throws {
    let scopeId = "flow:items"
    EVY.draftStore.activeScopeId = scopeId
    defer {
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    let address = samplePickupAddress()
    try EVY.writeRawValue(address, to: "{pickup_address}", scopeId: scopeId)

    XCTAssertEqual(
      try EVY.getDataFromText("{pickup_address.street}"),
      .string("28 Rothschild Avenue")
    )
    XCTAssertEqual(
      try EVY.getDataFromText("{pickup_address.city}"),
      .string("Rosebery")
    )

    try EVY.writeRawStringValue(
      "Leave at side gate",
      to: "{pickup_address.instructions}",
      scopeId: scopeId
    )
    guard case .dictionary(let updated) = try EVY.getDataFromText("{pickup_address}") else {
      return XCTFail("expected pickup_address dictionary after nested write")
    }
    XCTAssertEqual(updated["street"], .string("28 Rothschild Avenue"))
    XCTAssertEqual(updated["instructions"], .string("Leave at side gate"))
  }

  func testWriteRawValueUpdatesPageCacheNotFirstSyncedCollectionItem() throws {
    let resourceId = uniqueKey("items")
    let pageId = "page_\(UUID().uuidString)"
    let selectedItemId = UUID().uuidString
    let otherItemId = UUID().uuidString
    let selectedTitle = "Selected item"
    let otherTitle = "Other item in search"
    let updatedTitle = "Edited selected title"

    let selectedItem = EVYJson.dictionary([
      "id": .string(selectedItemId),
      "title": .string(selectedTitle),
    ])
    let otherItem = EVYJson.dictionary([
      "id": .string(otherItemId),
      "title": .string(otherTitle),
    ])

    try EVY.publicStore.applySyncedValue(
      namespace: MarketplaceTestFixture.service,
      resource: resourceId,
      value: .array([otherItem, selectedItem])
    )
    defer {
      try? EVY.publicStore.deleteAll(
        namespace: MarketplaceTestFixture.service, resource: resourceId)
    }

    EVY.activeCacheScopeId = pageId
    EVY.draftStore.activeScopeId = EVYDraft.ephemeralScopeId(forPageId: pageId)
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache,
      resource: pageId,
      id: resourceId,
      value: try JSONEncoder().encode(selectedItem)
    )

    var notificationKeys: [String] = []
    let observer = NotificationCenter.default.addObserver(
      forName: .evyValueChanged,
      object: nil,
      queue: nil
    ) { notification in
      if let key = notification.object as? String {
        notificationKeys.append(key)
      }
    }
    defer { NotificationCenter.default.removeObserver(observer) }

    try EVY.writeRawStringValue(updatedTitle, to: "{\(resourceId).title}")

    XCTAssertEqual(
      try EVY.getDataFromText("{\(resourceId).title}"),
      .string(updatedTitle),
      "Title writes must update the page-scoped cache row so live watchers recompute"
    )
    XCTAssertTrue(
      notificationKeys.contains("\(resourceId).title"),
      "Title writes must post a value-changed notification for heading/input watchers"
    )

    let otherRow = try EVY.publicStore.get(
      namespace: MarketplaceTestFixture.service,
      resource: resourceId,
      id: otherItemId
    )
    XCTAssertEqual(
      try otherRow.decoded(),
      otherItem,
      "Title writes must not mutate another synced collection item"
    )

    let selectedPublicRow = try EVY.publicStore.get(
      namespace: MarketplaceTestFixture.service,
      resource: resourceId,
      id: selectedItemId
    )
    XCTAssertEqual(
      try selectedPublicRow.decoded(),
      selectedItem,
      "Title writes on a view page should update the page cache, not the synced public row"
    )
  }

  func testWriteRawValueCreatesPickupAddressAsFreshDraft() throws {
    let scopeId = "flow:items"
    EVY.draftStore.activeScopeId = scopeId

    let address = samplePickupAddress()
    try EVY.writeRawValue(
      address,
      to: "{pickup_address}",
      scopeId: scopeId
    )

    XCTAssertEqual(
      try EVY.getDataFromText("{pickup_address}"),
      address
    )
  }

  private func samplePickupAddress() -> EVYJson {
    .dictionary([
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "latitude": .decimal(-33.9172075),
      "longitude": .decimal(151.1985883),
    ])
  }
}
