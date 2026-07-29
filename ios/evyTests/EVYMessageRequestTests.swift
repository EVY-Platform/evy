//
//  EVYMessageRequestTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYMessageRequestTests: XCTestCase {
  private let itemService = UUID().uuidString.lowercased()
  private let itemResource = UUID().uuidString.lowercased()
  private var itemId = ""
  private var requestId = ""

  override func setUpWithError() throws {
    // Without this, respond/cancel fire real RPCs at localhost:8000.
    installHermeticMutationSync()
    // Other classes create records, which records ownership, and do not reset the
    // ledger - the role cases below need one they own.
    EVYOwnershipLedger.reset()
    try? EVY.publicStore.wipeAll()
    try? EVY.privateStore.wipeAll()
    itemId = UUID().uuidString.lowercased()
    requestId = UUID().uuidString.lowercased()
  }

  override func tearDownWithError() throws {
    resetHermeticMutationSync()
    try? EVY.publicStore.wipeAll()
    try? EVY.privateStore.wipeAll()
    EVYOwnershipLedger.reset()
  }

  private func requestDatum(
    id: String? = nil,
    type: String = "pickup"
  ) -> EVYJson {
    EVYTestMessageFixtures.request(
      id: id ?? requestId,
      fk: itemId,
      service: itemService,
      resource: itemResource,
      type: type
    )
  }

  private func store(_ message: EVYJson) throws {
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      value: message
    )
  }

  /// The device owns the record the request addresses - the seller's position.
  private func ownAddressedRecord() {
    EVY.recordOwnership(service: itemService, resource: itemResource, id: itemId)
  }

  /// The device created the request - the buyer's position.
  private func ownRequest() {
    EVY.recordOwnership(
      service: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      id: requestId
    )
  }

  private func storedMessages() throws -> [[String: EVYJson]] {
    let rows = try EVY.privateStore.getAll(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue
    )
    return try rows.compactMap { row in
      guard case .dictionary(let values) = try row.decoded() else { return nil }
      return values
    }
  }

  // MARK: - classify

  func testClassifiesEveryTransferTypeAsARequest() throws {
    for type in ["pickup", "delivery", "shipping"] {
      let request = EVYMessageRequest.classify(requestDatum(type: type))
      XCTAssertEqual(request?.type, type, "\(type) should classify as a request")
      XCTAssertEqual(request?.id, requestId)
      XCTAssertEqual(request?.fk, itemId)
      XCTAssertEqual(request?.service, itemService)
      XCTAssertEqual(request?.resource, itemResource)
    }
  }

  func testDoesNotClassifyAResponseAsARequest() {
    for value in ["accept", "reject"] {
      let response = EVYTestMessageFixtures.response(
        id: UUID().uuidString,
        to: requestId,
        fk: itemId,
        service: itemService,
        resource: itemResource,
        value: value
      )
      XCTAssertNil(
        EVYMessageRequest.classify(response),
        "a \(value) response is not something to answer")
    }
  }

  /// A request says "pending" outright. Identifying one by an *absent* value would make
  /// every message that happens to carry no state look answerable.
  func testDoesNotClassifyAMessageWithNoValue() {
    let stateless = EVYTestMessageFixtures.message(
      id: requestId,
      fk: itemId,
      service: itemService,
      resource: itemResource,
      type: "pickup"
    )
    XCTAssertNil(EVYMessageRequest.classify(stateless))
  }

  func testDoesNotClassifyAnUnknownTransferType() {
    XCTAssertNil(EVYMessageRequest.classify(requestDatum(type: "teleport")))
  }

  func testDoesNotClassifyANonMessage() {
    XCTAssertNil(EVYMessageRequest.classify(.dictionary(["id": .string(itemId)])))
    XCTAssertNil(EVYMessageRequest.classify(.string("pickup")))
    XCTAssertNil(EVYMessageRequest.classify(nil))
  }

  // MARK: - role

  func testRoleIsRecipientWhenTheDeviceOwnsTheAddressedRecord() throws {
    ownAddressedRecord()
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    XCTAssertEqual(EVYMessageRequest.role(for: request), .recipient)
  }

  func testRoleIsSenderWhenTheDeviceCreatedTheRequest() throws {
    ownRequest()
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    XCTAssertEqual(EVYMessageRequest.role(for: request), .sender)
  }

  /// You cannot accept your own request, even on the device that also listed the item.
  func testSenderWinsOverRecipientWhenBothHold() throws {
    ownAddressedRecord()
    ownRequest()
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    XCTAssertEqual(EVYMessageRequest.role(for: request), .sender)
  }

  /// Receiving a message also puts it in the private store, which confers ownership of
  /// the message. That must not read as authorship, or a recipient would look like the
  /// sender and lose the affordance entirely.
  func testHoldingTheRequestPrivatelyIsNotAuthorship() throws {
    ownAddressedRecord()
    try store(requestDatum())
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    XCTAssertEqual(EVYMessageRequest.role(for: request), .recipient)
  }

  func testRoleIsNilWhenTheDeviceOwnsNeither() throws {
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    XCTAssertNil(EVYMessageRequest.role(for: request))
  }

  func testRoleIsNilWhenOwnershipIsForAnotherRecord() throws {
    EVY.recordOwnership(
      service: itemService, resource: itemResource, id: UUID().uuidString.lowercased())
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    XCTAssertNil(EVYMessageRequest.role(for: request))
  }

  // MARK: - isSettled

  func testIsSettledOnceSomethingNamesTheRequest() throws {
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))
    XCTAssertFalse(EVYMessageRequest.isSettled(request))

    try store(
      EVYTestMessageFixtures.response(
        id: UUID().uuidString.lowercased(),
        to: requestId,
        fk: itemId,
        service: itemService,
        resource: itemResource,
        value: "reject"
      ))

    XCTAssertTrue(EVYMessageRequest.isSettled(request))
  }

  func testIsSettledIgnoresMessagesNamingOtherRequests() throws {
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))
    try store(
      EVYTestMessageFixtures.response(
        id: UUID().uuidString.lowercased(),
        to: UUID().uuidString.lowercased(),
        fk: itemId,
        service: itemService,
        resource: itemResource,
        value: "accept"
      ))

    XCTAssertFalse(EVYMessageRequest.isSettled(request))
  }

  // MARK: - respond and cancel

  func testRespondCreatesAResponseAndLeavesTheRequestIntact() throws {
    try store(requestDatum())
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    try EVYMessageRequest.respond(to: request, with: .accept)

    let messages = try storedMessages()
    XCTAssertEqual(messages.count, 2, "the request survives; the answer is a new message")

    let response = try XCTUnwrap(
      messages.first { $0["id"] != .string(requestId) },
      "a response message should have been created")
    guard case .dictionary(let data) = response["data"] else {
      return XCTFail("response should carry a data object")
    }
    XCTAssertEqual(data["message_id"], .string(requestId))
    XCTAssertEqual(data["value"], .string("accept"))
    // The request's payload carries forward, because a flat `findFirst` that finds the
    // response cannot reach through it to the request for the details it displays.
    XCTAssertEqual(data["type"], .string("pickup"))
    XCTAssertEqual(
      data["time"], .string("2026-06-03T09:00:00"),
      "the accepted state has to be able to show the time that was agreed")
    XCTAssertEqual(response["fk"], .string(itemId))
    XCTAssertEqual(response["service"], .string(itemService))
    XCTAssertEqual(response["resource"], .string(itemResource))
    XCTAssertEqual(response["visibility"], .string("private"))
    XCTAssertNil(response["status"], "status is gone from the contract")

    // The latest message is what closes a request out, so answering touches nothing: the
    // stored request is byte-for-byte what arrived.
    let stored = try XCTUnwrap(messages.first { $0["id"] == .string(requestId) })
    XCTAssertEqual(.dictionary(stored), requestDatum(), "answering does not write to the request")
    guard case .dictionary(let requestData) = stored["data"] else {
      return XCTFail("request should keep its data object")
    }
    XCTAssertEqual(
      requestData["value"], .string("pending"),
      "the request is never rewritten to say it was answered")
  }

  /// A created record's `createdAt` orders it against every other message, so it has to be
  /// precise enough to distinguish two writes in the same second.
  func testCreatedMessageCarriesMillisecondPrecision() throws {
    let created = try EVY.create(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      data: [
        "fk": .string(itemId),
        "service": .string(itemService),
        "resource": .string(itemResource),
        "data": .dictionary(["type": .string("pickup"), "value": .string("pending")]),
      ]
    )

    let stored = try XCTUnwrap(try storedMessages().first { $0["id"] == .string(created) })
    guard case .string(let createdAt) = stored["createdAt"] else {
      return XCTFail("a created message should carry createdAt")
    }
    XCTAssertTrue(
      createdAt.contains("."),
      "createdAt is the ordering key, so it needs sub-second precision: got \(createdAt)")
  }

  /// The response has to sort after the request it answers, or the item page reads the
  /// request's `pending` as the current state and never leaves it.
  ///
  /// Both messages go through the real create path, microseconds apart — which is the
  /// production case and the one that ties at second resolution. `evySort` breaks equal keys
  /// by original order regardless of direction, and the request was stored first, so a tie
  /// hands the answer to the request.
  func testResponseSortsAfterTheRequestItAnswers() throws {
    let createdRequestId = try EVY.create(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.messages.rawValue,
      data: [
        "fk": .string(itemId),
        "service": .string(itemService),
        "resource": .string(itemResource),
        "data": .dictionary([
          "type": .string("pickup"),
          "value": .string("pending"),
          "time": .string("2026-06-03T09:00:00"),
        ]),
      ]
    )
    let stored = try XCTUnwrap(try storedMessages().first { $0["id"] == .string(createdRequestId) })
    let request = try XCTUnwrap(EVYMessageRequest.classify(.dictionary(stored)))

    try EVYMessageRequest.respond(to: request, with: .accept)

    let latest = try EVY.getDataFromText(
      "{findFirst(sort(\(EVYCoreResource.messages.rawValue), desc, createdAt),"
        + " fk == \(itemId) && data.type == pickup).data.value}")

    XCTAssertEqual(latest, .string("accept"), "the newest message about the request wins")
  }

  func testRespondWithRejectRecordsReject() throws {
    try store(requestDatum())
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    try EVYMessageRequest.respond(to: request, with: .reject)

    let response = try XCTUnwrap(
      try storedMessages().first { $0["id"] != .string(requestId) })
    guard case .dictionary(let data) = response["data"] else {
      return XCTFail("response should carry a data object")
    }
    XCTAssertEqual(data["value"], .string("reject"))
  }

  /// Withdrawing is a message too, so the request itself is untouched - which is what makes
  /// `Message` write-once.
  func testCancelAppendsACancelMessage() throws {
    try store(requestDatum())
    let request = try XCTUnwrap(EVYMessageRequest.classify(requestDatum()))

    try EVYMessageRequest.cancel(request)

    let messages = try storedMessages()
    XCTAssertEqual(messages.count, 2, "the request survives; the withdrawal is a new message")

    let cancellation = try XCTUnwrap(messages.first { $0["id"] != .string(requestId) })
    guard case .dictionary(let data) = cancellation["data"] else {
      return XCTFail("cancellation should carry a data object")
    }
    XCTAssertEqual(data["message_id"], .string(requestId))
    XCTAssertEqual(data["value"], .string("cancel"))
    XCTAssertEqual(
      data["type"], .string("pickup"),
      "the type carries forward so the item page's per-method lookup finds it")

    let stored = try XCTUnwrap(messages.first { $0["id"] == .string(requestId) })
    guard case .dictionary(let requestData) = stored["data"] else {
      return XCTFail("request should keep its data object")
    }
    XCTAssertEqual(requestData["value"], .string("pending"))
  }

  // MARK: - swipeActions

  func testRecipientIsOfferedAcceptAndReject() throws {
    ownAddressedRecord()
    try store(requestDatum())

    let actions = EVYMessageRequest.swipeActions(for: requestDatum())

    XCTAssertEqual(actions.map(\.id), ["accept", "reject"])
  }

  func testSenderIsOfferedCancelOnly() throws {
    ownRequest()
    try store(requestDatum())

    let actions = EVYMessageRequest.swipeActions(for: requestDatum())

    XCTAssertEqual(actions.map(\.id), ["cancel"])
  }

  func testNoAffordanceOnceTheRequestIsAnswered() throws {
    ownAddressedRecord()
    try store(requestDatum())
    try store(
      EVYTestMessageFixtures.response(
        id: UUID().uuidString.lowercased(),
        to: requestId,
        fk: itemId,
        service: itemService,
        resource: itemResource,
        value: "accept"
      ))

    XCTAssertTrue(EVYMessageRequest.swipeActions(for: requestDatum()).isEmpty)
  }

  /// A withdrawn request is settled by the cancel message naming it, exactly as an answered
  /// one is - there is no field on the request that says so.
  func testNoAffordanceOnACancelledRequest() throws {
    ownAddressedRecord()
    try store(requestDatum())
    try store(
      EVYTestMessageFixtures.response(
        id: UUID().uuidString.lowercased(),
        to: requestId,
        fk: itemId,
        service: itemService,
        resource: itemResource,
        value: "cancel"
      ))

    XCTAssertTrue(EVYMessageRequest.swipeActions(for: requestDatum()).isEmpty)
  }

  func testNoAffordanceWithoutARole() throws {
    try store(requestDatum())

    XCTAssertTrue(EVYMessageRequest.swipeActions(for: requestDatum()).isEmpty)
  }

  func testNoAffordanceOnAResponse() throws {
    ownAddressedRecord()
    let response = EVYTestMessageFixtures.response(
      id: UUID().uuidString.lowercased(),
      to: requestId,
      fk: itemId,
      service: itemService,
      resource: itemResource,
      value: "accept"
    )

    XCTAssertTrue(EVYMessageRequest.swipeActions(for: response).isEmpty)
  }
}
