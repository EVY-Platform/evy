//
//  EVYStoreRoutingTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYStoreRoutingTests: XCTestCase {
  override func setUpWithError() throws {
    // Without this the create/update cases below fire real RPCs at localhost:8000.
    installHermeticMutationSync()
    // Other classes create records, which records ownership, and do not reset the
    // ledger - so the ownership cases below need a clean one they own.
    EVYOwnershipLedger.reset()
  }

  override func tearDownWithError() throws {
    resetHermeticMutationSync()
    try? EVY.publicStore.wipeAll()
    try? EVY.privateStore.wipeAll()
    EVYOwnershipLedger.reset()
  }

  func testApplySyncedValueRoutesByVisibility() throws {
    let publicId = UUID().uuidString
    let privateId = UUID().uuidString
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.addresses.ref,
      value: .array([
        .dictionary(["id": .string(publicId), "visibility": .string("public")]),
        .dictionary(["id": .string(privateId), "visibility": .string("private")]),
      ])
    )

    XCTAssertNotNil(
      try? EVY.publicStore.get(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.addresses.ref,
        id: publicId))
    XCTAssertNotNil(
      try? EVY.privateStore.get(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.addresses.ref,
        id: privateId))
  }

  func testApplySyncedValueMovesRecordWhenVisibilityChanges() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.addresses.ref
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("public")])
    )
    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("private")])
    )
    XCTAssertNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
    XCTAssertNotNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  func testBindingReadsResolvePrivateStoreRecords() throws {
    let recordId = UUID().uuidString
    let street = "28 Rothschild Avenue"
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.addresses.ref,
      value: .array([
        .dictionary([
          "id": .string(recordId),
          "street": .string(street),
          "visibility": .string("private"),
        ])
      ])
    )

    let collection = try _getDataFromText("{\(EVYCoreResource.addresses.ref)}")
    guard case .array(let items) = collection else {
      return XCTFail("Expected address collection")
    }
    XCTAssertEqual(items.count, 1)

    let first = try _getDataFromText(
      "{findFirst(\(EVYCoreResource.addresses.ref), id == \(recordId)).street}")
    XCTAssertEqual(first, .string(street))
  }

  func testUpdatePatchesPrivateStoreRecord() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.messages.ref
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary([
        "id": .string(recordId),
        "status": .string("pending"),
        "visibility": .string("private"),
      ])
    )

    try EVY.update(
      namespace: EVYNamespace.evy,
      resource: resource,
      matching: ["id": .string(recordId), "status": .string("pending")],
      changes: ["status": .string("accepted")]
    )

    let row = try EVY.privateStore.get(
      namespace: EVYNamespace.evy, resource: resource, id: recordId)
    let decoded = try row.decoded()
    guard case .dictionary(let values) = decoded else {
      return XCTFail("Expected dictionary payload")
    }
    XCTAssertEqual(values["status"], .string("accepted"))
  }

  func testCreateWithGeneratedIdRoutesByVisibility() throws {
    let namespace = EVYNamespace.evy
    let resource = "routing-create-test"
    defer { try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource) }
    defer { try? EVY.privateStore.deleteAll(namespace: namespace, resource: resource) }

    _ = try EVY.create(
      namespace: namespace,
      resource: resource,
      data: ["visibility": .string("private")]
    )
    let privateRows = try EVY.privateStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(privateRows.count, 1)

    _ = try EVY.create(namespace: namespace, resource: resource, data: [:])
    let publicRows = try EVY.publicStore.getAll(namespace: namespace, resource: resource)
    XCTAssertEqual(publicRows.count, 1)
    let publicDecoded = try publicRows[0].decoded()
    guard case .dictionary(let values) = publicDecoded else {
      return XCTFail("Expected dictionary payload")
    }
    // The client does not invent a visibility: each resource defaults its own
    // server-side, and sending one would override that. An unset visibility routes to
    // the public store until the record syncs back with the value the server chose.
    XCTAssertNil(values["visibility"])
  }

  func testRemoveSyncedValueDeletesFromPublicStore() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.messages.ref
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("public")])
    )
    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))

    try EVY.removeSyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId)])
    )

    XCTAssertNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  func testRemoveSyncedValueDeletesFromPrivateStore() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.addresses.ref
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("private")])
    )
    XCTAssertNotNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))

    // The delete payload need not carry visibility, so both stores are cleared.
    try EVY.removeSyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId)])
    )

    XCTAssertNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  func testRemoveSyncedValueHandlesArraysAndMissingRecords() throws {
    let presentId = UUID().uuidString
    let absentId = UUID().uuidString
    let resource = EVYCoreResource.messages.ref
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(presentId), "visibility": .string("public")])
    )

    try EVY.removeSyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary(["id": .string(presentId)]),
        .dictionary(["id": .string(absentId)]),
      ])
    )

    XCTAssertNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: presentId))
  }

  func testRecordsWithoutVisibilityDefaultToPublicStore() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.flows.ref
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId)])
    )
    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
    XCTAssertNil(
      try? EVY.privateStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  // MARK: - Tombstones and delta ordering

  func testSyncedTombstoneRemovesTheRecord() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.messages.ref
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .dictionary(["id": .string(recordId), "visibility": .string("public")])
    )
    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary([
          "id": .string(recordId),
          "visibility": .string("public"),
          "deleted_at": .string("2026-07-01T00:00:00.000Z"),
        ])
      ])
    )

    XCTAssertNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  func testLiveRecordsWithoutDeletedAtAreKept() throws {
    let recordId = UUID().uuidString
    let resource = EVYCoreResource.messages.ref

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary([
          "id": .string(recordId),
          "visibility": .string("public"),
          "deleted_at": .null,
        ])
      ])
    )

    XCTAssertNotNil(
      try? EVY.publicStore.get(namespace: EVYNamespace.evy, resource: resource, id: recordId))
  }

  /// A delta carries only what changed, so its positions must not renumber the
  /// rows already held.
  func testDeltaDoesNotReorderExistingRecords() throws {
    let resource = EVYCoreResource.messages.ref
    let firstId = UUID().uuidString
    let secondId = UUID().uuidString

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary(["id": .string(firstId), "visibility": .string("public")]),
        .dictionary(["id": .string(secondId), "visibility": .string("public")]),
      ])
    )

    let originalSecond = try EVY.publicStore.get(
      namespace: EVYNamespace.evy, resource: resource, id: secondId
    ).sortIndex
    XCTAssertEqual(originalSecond, 1)

    // The second row changes on its own; as position 0 of the delta it would
    // previously have jumped to the front of the collection.
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary([
          "id": .string(secondId), "visibility": .string("public"),
          "status": .string("accepted"),
        ])
      ]),
      assignsOrder: false
    )

    let updatedSecond = try EVY.publicStore.get(
      namespace: EVYNamespace.evy, resource: resource, id: secondId)
    XCTAssertEqual(updatedSecond.sortIndex, originalSecond)
  }

  func testNewRecordInADeltaIsAppended() throws {
    let resource = EVYCoreResource.messages.ref
    let firstId = UUID().uuidString
    let newId = UUID().uuidString

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary(["id": .string(firstId), "visibility": .string("public")])
      ])
    )

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        .dictionary(["id": .string(newId), "visibility": .string("public")])
      ]),
      assignsOrder: false
    )

    let appended = try EVY.publicStore.get(
      namespace: EVYNamespace.evy, resource: resource, id: newId)
    XCTAssertGreaterThan(appended.sortIndex, 0)
  }

  // MARK: - Scope as a value

  /// An explicit scope must win over the global statics. Without this, a view
  /// resolving off the foreground page reads whichever scope was set last.
  func testExplicitScopeOverridesTheGlobalCacheScope() throws {
    let globalScopeId = "global-\(UUID().uuidString)"
    let explicitScopeId = "explicit-\(UUID().uuidString)"
    let key = "scoped_value"

    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: globalScopeId, id: key,
      value: #"{"label":"from-global"}"#.data(using: .utf8)!)
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: explicitScopeId, id: key,
      value: #"{"label":"from-explicit"}"#.data(using: .utf8)!)
    defer {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: globalScopeId)
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: explicitScopeId)
      EVY.activeCacheScopeId = nil
    }

    EVY.activeCacheScopeId = globalScopeId

    XCTAssertEqual(
      try EVY.getDataFromText("{\(key).label}"), .string("from-global"))

    XCTAssertEqual(
      try EVY.getDataFromText(
        "{\(key).label}",
        scope: EVYScope(cacheScopeId: explicitScopeId, draftScopeId: nil)),
      .string("from-explicit"))
  }

  func testOmittingScopeStillUsesTheGlobals() throws {
    let globalScopeId = "global-\(UUID().uuidString)"
    let key = "scoped_value"

    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: globalScopeId, id: key,
      value: #"{"label":"from-global"}"#.data(using: .utf8)!)
    defer {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: globalScopeId)
      EVY.activeCacheScopeId = nil
    }

    EVY.activeCacheScopeId = globalScopeId

    XCTAssertEqual(
      try EVY.getValueFromText("{\(key).label}").toString(), "from-global")
  }

  /// A state built on one page must keep resolving against that page's scope
  /// after the user navigates away. Recomputes fire on a notification, long
  /// after construction, so reading the globals at that moment resolves against
  /// whichever page happens to be foremost - the background page silently
  /// renders the foreground page's data.
  func testStateRecomputesAgainstItsOwnScopeAfterAnotherPageActivates() throws {
    let backgroundScopeId = "background-\(UUID().uuidString)"
    let foregroundScopeId = "foreground-\(UUID().uuidString)"
    let key = "scoped_value"
    let resource = EVYCoreResource.messages.ref

    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: backgroundScopeId, id: key,
      value: #"{"label":"background-page"}"#.data(using: .utf8)!)
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: foregroundScopeId, id: key,
      value: #"{"label":"foreground-page"}"#.data(using: .utf8)!)

    let recordId = UUID().uuidString
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([.dictionary(["id": .string(recordId), "status": .string("pending")])])
    )
    defer {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: backgroundScopeId)
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: foregroundScopeId)
      EVY.activeCacheScopeId = nil
    }

    // The background page is on screen, and builds a state that resolves a
    // value out of its own cache scope but recomputes when the record changes.
    EVY.activeCacheScopeId = backgroundScopeId
    let state = EVYState(
      textToWatch: "{\(resource)}",
      setter: { (try? EVY.getValueFromText("{\(key).label}").toString()) ?? "unresolved" }
    )
    XCTAssertEqual(state.value, "background-page")

    // The user navigates to another page, which activates its own scope.
    EVY.activeCacheScopeId = foregroundScopeId

    // Something the background page watches changes, forcing a recompute.
    try EVY.update(
      namespace: EVYNamespace.evy,
      resource: resource,
      matching: ["id": .string(recordId)],
      changes: ["status": .string("accepted")]
    )

    XCTAssertEqual(state.value, "background-page")
  }

  /// A row can be built while another page is foremost - a websocket SDUI
  /// update adding rows to a page the user has navigated away from. Its
  /// initial value has to come from its own scope, not from whatever page
  /// happens to be active at that instant.
  func testStateBuiltWithAnExplicitScopeIgnoresTheActiveGlobal() throws {
    let ownScopeId = "own-\(UUID().uuidString)"
    let activeScopeId = "active-\(UUID().uuidString)"
    let key = "scoped_value"

    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: ownScopeId, id: key,
      value: #"{"label":"own-page"}"#.data(using: .utf8)!)
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: activeScopeId, id: key,
      value: #"{"label":"active-page"}"#.data(using: .utf8)!)
    defer {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: ownScopeId)
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: activeScopeId)
      EVY.activeCacheScopeId = nil
    }

    EVY.activeCacheScopeId = activeScopeId
    let state = EVYState(
      watches: ["{\(EVYCoreResource.messages.ref)}"],
      scope: .cache(ownScopeId),
      setter: { (try? EVY.getValueFromText("{\(key).label}").toString()) ?? "unresolved" }
    )

    XCTAssertEqual(state.value, "own-page")
    // And the swap is undone - the active page is untouched.
    XCTAssertEqual(EVY.activeCacheScopeId, activeScopeId)
  }

  /// Writes have to land where the row's own bindings read from. Mutation
  /// paths take the cache scope ambiently, so an action running while some
  /// other page is active would otherwise read and update that page's cache -
  /// which is what running the action under the row's scope prevents.
  func testWriteUnderAnExplicitScopeTargetsThatScope() throws {
    let ownScopeId = "own-\(UUID().uuidString)"
    let activeScopeId = "active-\(UUID().uuidString)"
    let key = "scoped_value"

    for (scopeId, label) in [(ownScopeId, "own"), (activeScopeId, "active")] {
      try EVY.cacheStore.create(
        namespace: EVYNamespace.cache, resource: scopeId, id: key,
        value: #"{"label":"\#(label)"}"#.data(using: .utf8)!)
    }
    defer {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: ownScopeId)
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: activeScopeId)
      EVY.activeCacheScopeId = nil
    }

    EVY.activeCacheScopeId = activeScopeId

    try EVY.withScope(.cache(ownScopeId)) {
      try EVY.updateData(
        #""written""#.data(using: .utf8)!,
        destination: "{\(key).label}")
    }

    XCTAssertEqual(
      try EVY.getDataFromText(
        "{\(key).label}", scope: .cache(ownScopeId)),
      .string("written"))
    XCTAssertEqual(
      try EVY.getDataFromText(
        "{\(key).label}", scope: .cache(activeScopeId)),
      .string("active"))
  }

  // MARK: - Ownership ledger

  func testOwnedResourcesIsEmptyOnACleanStore() throws {
    XCTAssertTrue(EVY.ownedResources().isEmpty)
  }

  func testRecordOwnershipGroupsIdsByResource() throws {
    let itemsRef = "test.items"
    let messagesRef = "test.messages"
    let firstId = UUID().uuidString.lowercased()
    let secondId = UUID().uuidString.lowercased()
    let otherResourceId = UUID().uuidString.lowercased()

    EVY.recordOwnership(resource: itemsRef, id: firstId)
    EVY.recordOwnership(resource: itemsRef, id: secondId)
    EVY.recordOwnership(resource: messagesRef, id: otherResourceId)

    let owned = EVY.ownedResources().sorted { $0.resource < $1.resource }
    XCTAssertEqual(owned.count, 2)
    XCTAssertEqual(owned[0].resource, itemsRef)
    XCTAssertEqual(owned[0].ids, [firstId, secondId].sorted())
    XCTAssertEqual(owned[1].resource, messagesRef)
    XCTAssertEqual(owned[1].ids, [otherResourceId])
  }

  func testRecordOwnershipIsIdempotent() throws {
    let itemsRef = "test.items"
    let recordId = UUID().uuidString.lowercased()

    EVY.recordOwnership(resource: itemsRef, id: recordId)
    EVY.recordOwnership(resource: itemsRef, id: recordId)

    let owned = EVY.ownedResources().filter { $0.resource == itemsRef }
    XCTAssertEqual(owned.count, 1)
    XCTAssertEqual(owned[0].ids, [recordId])
  }

  func testCreateRecordsOwnershipOfTheNewRecord() throws {
    let resource = "evy.ownership-create-test"
    defer { try? EVY.publicStore.deleteAll(namespace: EVYNamespace.evy, resource: resource) }

    let createdId = try EVY.create(namespace: EVYNamespace.evy, resource: resource, data: [:])

    let owned = EVY.ownedResources().filter { $0.resource == resource }
    XCTAssertEqual(owned.count, 1)
    XCTAssertEqual(owned[0].ids, [createdId])
  }

  func testSyncedPublicRecordsAreNotOwned() throws {
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.ref,
      value: .dictionary([
        "id": .string(UUID().uuidString.lowercased()),
        "visibility": .string("public"),
      ])
    )

    XCTAssertTrue(EVY.ownedResources().isEmpty)
  }

  /// A message that reaches this device lands in the private store, and holding it
  /// privately is what keeps its later updates arriving.
  func testSyncedPrivateRecordsAreOwned() throws {
    let recordId = UUID().uuidString.lowercased()

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.ref,
      value: .dictionary([
        "id": .string(recordId),
        "visibility": .string("private"),
      ])
    )

    let owned = EVY.ownedResources()
    XCTAssertEqual(owned.count, 1)
    XCTAssertEqual(owned[0].resource, EVYCoreResource.messages.ref)
    XCTAssertEqual(owned[0].ids, [recordId])
  }

  /// `visibility` cannot express "mine" - a marketplace item is public so every
  /// device sees the catalogue - so the ledger is the only thing that keeps a
  /// seller entitled to messages about an item they created.
  func testCreatedPublicRecordsAreOwned() throws {
    let resource = "marketplace.ownership-public-create-test"
    defer {
      try? EVY.publicStore.deleteAll(namespace: MarketplaceTestFixture.service, resource: resource)
    }

    let createdId = try EVY.create(
      namespace: MarketplaceTestFixture.service, resource: resource,
      data: ["visibility": .string("public")])

    XCTAssertEqual(
      try EVY.publicStore.getAll(namespace: MarketplaceTestFixture.service, resource: resource)
        .count, 1)
    let owned = EVY.ownedResources().filter { $0.resource == resource }
    XCTAssertEqual(owned.count, 1)
    XCTAssertEqual(owned[0].ids, [createdId])
  }

  /// Local singletons share the private store but are not records the server knows,
  /// and their `current` id is not a uuid. Declaring one would fail the sync request
  /// schema and take every resource down with it, not just messages.
  func testLocalSingletonsInThePrivateStoreAreNotOwned() throws {
    let key = uniqueKey("local_ownership")
    let (localStore, localKey) = EVY.store(for: "$local:\(key)")
    try localStore.create(
      namespace: EVYNamespace.local,
      resource: localKey,
      id: EVYNamespace.singletonId,
      value: try JSONEncoder().encode(EVYJson.string("private"))
    )

    let owned = EVY.ownedResources()
    XCTAssertFalse(owned.contains { $0.resource.hasPrefix("\(EVYNamespace.local).") })
    XCTAssertFalse(owned.flatMap(\.ids).contains(EVYNamespace.singletonId))
  }
}
