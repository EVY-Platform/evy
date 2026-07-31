//
//  e2eRequests.swift
//  evyUITests
//

import XCTest

// MARK: - Marketplace request flows (WebSocket)

final class WebSocketRequestE2ETests: E2ETestBase {
  override var homeFlowId: String? { E2EFlowIds.webSocketHomeFlow }

  override func setUpWithError() throws {
    continueAfterFailure = false
    try seedIsolatedFlows()
    try launchApp()
  }

  override func tearDownWithError() throws {
    try? seedIsolatedFlows()
    try super.tearDownWithError()
  }

  @MainActor
  func testTimeslotPickerCreatesPickupRequest() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, selectedItemTitle) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Pickup request item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Request pickup",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "data_changed")

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    timeslot.tap()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    XCTAssertTrue(
      app.staticTexts.containing(
        NSPredicate(format: "label CONTAINS %@", selectedItemTitle)
      ).firstMatch.waitForExistence(timeout: 5),
      "Confirmation sheet should mention the item title")

    tapConfirmationSheetRequestButton()
    XCTAssertFalse(
      app.alerts.firstMatch.waitForExistence(timeout: 2),
      "Pickup request should not show a native confirmation alert")

    let pickupRequestCreated = try await waitForMessage(
      emitter: emitter,
      type: "pickup",
      itemId: selectedItemId,
      valueKey: "time",
      value: selectedTimeslot
    )
    XCTAssertTrue(
      pickupRequestCreated,
      "Tapping a pickup timeslot should create a matching marketplace message"
    )
    await emitter.disconnect()
  }

  @MainActor
  func testTimeslotConfirmationCancelDoesNotCreateRequest() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Cancel pickup item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Cancel pickup",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    timeslot.tap()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    dismissConfirmationSheet()

    let messagesAfterCancel = try await emitter.getResource(
      resource: EVYCoreResource.messages.ref
    )
    XCTAssertFalse(
      Self.messagesContain(
        messagesAfterCancel,
        type: "pickup",
        itemId: selectedItemId
      ),
      "Cancelling confirmation should not create a pickup request"
    )
    XCTAssertTrue(timeslot.exists, "Pickup timeslot should remain visible after cancel")
    XCTAssertFalse(
      app.buttons["Cancel pickup request"].exists,
      "Cancel pickup request should not appear when no request was created"
    )
    await emitter.disconnect()
  }

  @MainActor
  func testPickupConfirmationSheetShowsEarlierTimeslotWarning() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Later pickup item",
      pickupSelection: ["2026-06-03T09:00:00", "2026-06-03T10:00:00"]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Later pickup",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )

    let laterTimeslot = app.staticTexts["10:00"].firstMatch
    XCTAssertTrue(
      laterTimeslot.waitForExistence(timeout: 10), "Later pickup timeslot should be visible")
    laterTimeslot.tap()

    let earlierTimeslotWarning = app.staticTexts.containing(
      NSPredicate(format: "label CONTAINS %@", "earlier than your selected timeslot")
    ).firstMatch
    XCTAssertTrue(
      earlierTimeslotWarning.waitForExistence(timeout: 5),
      "Later timeslot confirmation should show the earlier-timeslot warning")

    dismissConfirmationSheet()
    XCTAssertTrue(
      waitForConfirmationSheetDismissed(timeout: 5),
      "Confirmation sheet should dismiss")

    let earlierTimeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(
      earlierTimeslot.waitForExistence(timeout: 10), "Earlier pickup timeslot should be visible")
    earlierTimeslot.tap()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Confirmation sheet should reopen for the earlier timeslot")
    XCTAssertFalse(
      earlierTimeslotWarning.waitForExistence(timeout: 2),
      "Earliest timeslot confirmation should not show the earlier-timeslot warning")
    await emitter.disconnect()
  }

  @MainActor
  func testCancelRequestTogglesPickerAndShippingButton() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Cancel request item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Cancel request",
      itemId: selectedItemId,
      viewFlowDataBuilder: Self.viewItemCancelRequestFlowData,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "data_changed")

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    XCTAssertFalse(
      app.buttons["Cancel pickup request"].exists,
      "Cancel pickup request should be hidden before a request exists")

    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    tapConfirmationSheetRequestButton()

    let pickupRequestCreated = try await waitForMessage(
      emitter: emitter,
      type: "pickup",
      itemId: selectedItemId,
      valueKey: "time",
      value: selectedTimeslot
    )
    XCTAssertTrue(pickupRequestCreated, "Tapping a pickup timeslot should create a message")

    let cancelButton = app.buttons["Cancel pickup request"].firstMatch
    XCTAssertTrue(
      cancelButton.waitForExistence(timeout: 10),
      "Cancel pickup request should replace the transfer tabs and pickup timeslot")
    XCTAssertFalse(timeslot.exists, "Pickup timeslot should be hidden after creating a request")
    XCTAssertFalse(
      app.segmentedControls.buttons["Shipping"].waitForExistence(timeout: 2),
      "Transfer tabs collapse while an arrangement is in flight, leaving just that request")

    cancelButton.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Cancel pickup confirmation sheet should appear")
    // The row button and the sheet's confirm button share the "Cancel request" label; tap the
    // hittable one (the confirm button on top of the sheet) so the write actually fires.
    let confirmCancelButton = try XCTUnwrap(
      waitForHittableButton(labeled: "Cancel request"),
      "Confirm cancel button should be tappable in the sheet")
    confirmCancelButton.tap()

    let requestWithdrawn = try await waitForMessage(
      emitter: emitter,
      itemId: selectedItemId,
      valueKey: "value",
      value: "cancel"
    )
    XCTAssertTrue(
      requestWithdrawn, "Cancel request should append a cancel message, not rewrite the request")
    XCTAssertTrue(
      timeslot.waitForExistence(timeout: 10),
      "Pickup timeslot should return after cancelling the request")

    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should reopen after cancelling the request")
    tapConfirmationSheetRequestButton()
    XCTAssertTrue(
      app.buttons["Cancel pickup request"].firstMatch.waitForExistence(timeout: 10),
      "Cancel pickup request should reappear after creating another request")
    await emitter.disconnect()
  }

  /// The case the latest-message model exists for: a rejection is terminal but leaves nothing
  /// in flight, so the buyer is back to picking a timeslot and can ask again. The old
  /// predicates could not express this - the request was still there, unanswered as far as any
  /// flat lookup could tell.
  @MainActor
  func testRejectedRequestReturnsTheTimeslots() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Rejected request item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Rejected request",
      itemId: selectedItemId,
      viewFlowDataBuilder: Self.viewItemCancelRequestFlowData,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "data_changed")

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    tapConfirmationSheetRequestButton()

    XCTAssertTrue(
      waitForCancelRequestVisible(timeout: 10),
      "Cancel pickup request should be visible while the request is open")

    let requestId = try await waitForMessageId(
      emitter: emitter,
      itemId: selectedItemId,
      type: "pickup",
      value: "pending",
      failureMessage: "An open pickup request should exist for the item"
    )

    // The owner rejects. Like every other settling message it names the request and carries
    // its payload forward.
    _ = try await emitter.createResource(
      resource: EVYCoreResource.messages.ref,
      data: [
        "fk": selectedItemId,
        "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
        "visibility": "private",
        "parent_message_id": requestId,
        "data": Self.settlingMessageData(
          value: "reject",
          type: "pickup",
          time: selectedTimeslot
        ),
      ]
    )
    let rejectedOnServer = try await waitForMessageResponse(
      emitter: emitter,
      messageId: requestId,
      value: "reject"
    )
    XCTAssertTrue(rejectedOnServer, "The API should hold the message rejecting the request")

    XCTAssertTrue(
      waitForCancelRequestHidden(timeout: 10),
      "Cancel pickup request should go once the request has been answered")
    XCTAssertTrue(
      timeslot.waitForExistence(timeout: 10),
      "Pickup timeslots should return after a rejection")
    XCTAssertFalse(
      app.staticTexts.matching(
        NSPredicate(format: "label BEGINSWITH %@", "Pickup confirmed for")
      ).firstMatch.exists,
      "A rejection is not a confirmation")

    // And the buyer can ask again, which is the whole point.
    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should reopen after a rejection")
    tapConfirmationSheetRequestButton()
    XCTAssertTrue(
      waitForCancelRequestVisible(timeout: 10),
      "A fresh request after a rejection is open again")

    await emitter.disconnect()
  }

  /// The id of a message for an item, as the server holds it.
  @MainActor
  private func waitForMessageId(
    emitter: WSEmitter,
    itemId: String,
    type: String = "pickup",
    value: String? = "pending",
    failureMessage: String,
    timeout: TimeInterval = 10
  ) async throws -> String {
    let deadline = Date().addingTimeInterval(timeout)
    repeat {
      let payload = try await emitter.getResource(
        resource: EVYCoreResource.messages.ref
      )
      if let rows = Self.responseDataArray(from: payload),
        let match = rows.compactMap({ $0 as? [String: Any] }).first(where: { row in
          let data = row["data"] as? [String: Any]
          guard row["fk"] as? String == itemId,
            data?["type"] as? String == type
          else { return false }
          if let value {
            return data?["value"] as? String == value
          }
          return true
        }),
        let id = match["id"] as? String
      {
        return id
      }
    } while try await emitter.nextDataChanged(
      resource: EVYCoreResource.messages.ref, deadline: deadline)
    XCTFail(failureMessage)
    return ""
  }

  @MainActor
  func testAcceptedRequestHidesCancelAndShowsConfirmation() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Accepted request item",
      pickupSelection: [selectedTimeslot]
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Accepted request",
      itemId: selectedItemId,
      viewFlowDataBuilder: Self.viewItemCancelRequestFlowData,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "data_changed")

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 10), "Pickup timeslot should be visible")
    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    tapConfirmationSheetRequestButton()

    let pickupRequestCreated = try await waitForMessage(
      emitter: emitter,
      type: "pickup",
      itemId: selectedItemId,
      valueKey: "time",
      value: selectedTimeslot
    )
    XCTAssertTrue(pickupRequestCreated, "Tapping a pickup timeslot should create a message")
    XCTAssertTrue(
      waitForCancelRequestVisible(timeout: 10),
      "Cancel pickup request should be visible for a pending request")

    let messagesPayload = try await emitter.getResource(
      resource: EVYCoreResource.messages.ref
    )
    let messageRows = try XCTUnwrap(
      Self.responseDataArray(from: messagesPayload),
      "Messages payload should be an array"
    )
    let request = try XCTUnwrap(
      messageRows.compactMap { $0 as? [String: Any] }.first {
        $0["id"] as? String != nil
          && ($0["data"] as? [String: Any])?["type"] as? String == "pickup"
          && $0["fk"] as? String == selectedItemId
      },
      "Created pickup message should be readable from the API"
    )
    let messageId = try XCTUnwrap(
      request["id"] as? String,
      "Created pickup message should include an id"
    )

    // Accepting is a new message naming the request, not an edit to it - and it carries
    // the request's payload forward. `findFirst` predicates cannot nest, so the row that
    // says "Pickup confirmed for …" reads the time off the message that says "accepted".
    _ = try await emitter.createResource(
      resource: EVYCoreResource.messages.ref,
      data: [
        "fk": selectedItemId,
        "resource": MARKETPLACE_ITEMS_RESOURCE_ID,
        "visibility": "private",
        "parent_message_id": messageId,
        "data": Self.settlingMessageData(
          value: "accept",
          type: "pickup",
          time: selectedTimeslot,
          pickupAddress: Self.amazingFridgePickupAddressRow
        ),
      ]
    )
    let acceptedOnServer = try await waitForMessageResponse(
      emitter: emitter,
      messageId: messageId,
      value: "accept"
    )
    XCTAssertTrue(
      acceptedOnServer,
      "The API should persist the message that accepts the pickup request")

    XCTAssertTrue(
      waitForCancelRequestHidden(timeout: 10),
      "Cancel pickup request should hide once the request is answered")
    XCTAssertTrue(
      app.staticTexts.matching(
        NSPredicate(format: "label BEGINSWITH %@", "Pickup confirmed for")
      ).firstMatch.waitForExistence(timeout: 10),
      "Pickup segment should show the accepted confirmation row")
    // The postcode map gives way to the seller's full address, which only exists on the accept.
    XCTAssertTrue(
      app.staticTexts["C509 28 Rothschild Avenue, 2018 Rosebery NSW"].waitForExistence(
        timeout: 10),
      "Accepted pickup should show the full address carried by the accept message")
    XCTAssertFalse(
      app.segmentedControls.buttons["Shipping"].waitForExistence(timeout: 2),
      "Transfer tabs stay collapsed once an arrangement is agreed")
    let shippingConfirmation = app.staticTexts.matching(
      NSPredicate(format: "label BEGINSWITH %@", "Shipping confirmed")
    ).firstMatch
    XCTAssertFalse(
      shippingConfirmation.waitForExistence(timeout: 2),
      "Shipping confirmation should stay hidden for an accepted pickup request")

    await emitter.disconnect()
  }

  @MainActor
  func testSenderIsOfferedCancelAndCannotAnswerItsOwnRequest() throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    let host = apiHost
    let selectedTimeslot = "2026-06-03T09:00:00"
    let (itemId, _) = try awaitResult("create sender cancel item") {
      try await emitter.connect(host: host)
      try await emitter.login(token: "e2e-test", os: "ios")
      return try await self.createMarketplaceItem(
        emitter: emitter,
        titlePrefix: "Sender cancel item",
        pickupSelection: [selectedTimeslot]
      )
    }

    let viewLabel = "Sender cancel \(Int(Date().timeIntervalSince1970))"
    let homeFlowData = createHomeFlowData(
      buttonLabel: viewLabel,
      viewItemId: itemId,
      includeHomeInbox: true
    )
    let senderFlowData = E2ETestBase.senderViewFlowData(
      flowId: E2EFlowIds.webSocketViewFlow,
      pageId: E2EFlowIds.webSocketViewPage
    )
    try awaitResult("seed sender inbox flow") {
      try await emitter.updateSDUI(
        flowData: homeFlowData,
        flowId: E2EFlowIds.webSocketHomeFlow
      )
      try await emitter.updateSDUI(
        flowData: senderFlowData,
        flowId: E2EFlowIds.webSocketViewFlow
      )
      try await emitter.subscribe(event: "data_changed")
    }

    app.terminate()
    try launchApp()
    let viewButton = app.buttons[viewLabel]
    XCTAssertTrue(
      viewButton.waitForExistence(timeout: 20),
      "Sender request view button should load")
    XCTAssertTrue(
      scrollUntilHittable(viewButton),
      "Sender request view button should be reachable")
    viewButton.tap()

    let timeslot = app.staticTexts["09:00"].firstMatch
    XCTAssertTrue(timeslot.waitForExistence(timeout: 15), "Pickup timeslot should be visible")
    timeslot.tap()
    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Pickup confirmation sheet should appear after selecting a timeslot")
    tapConfirmationSheetRequestButton()

    let requestId = try awaitResult("wait for sender request") {
      try await self.waitForMessageId(
        emitter: emitter,
        itemId: itemId,
        type: "pickup",
        value: nil,
        failureMessage: "Tapping a pickup timeslot should have created a request"
      )
    }
    let backButton = app.navigationBars.buttons.firstMatch
    XCTAssertTrue(
      backButton.waitForExistence(timeout: 5), "The request page should have a back button")
    backButton.tap()

    let fromYouTab = app.segmentedControls.buttons["From you"]
    XCTAssertTrue(
      fromYouTab.waitForExistence(timeout: 10),
      "The inbox should include a From you tab")
    XCTAssertTrue(
      scrollUntilHittable(fromYouTab),
      "The From you tab should be reachable below the request picker")
    fromYouTab.tap()

    let childRowId = E2ETestBase.homeInboxFromYouChildRowId
    let row = app.otherElements["swipeRow_\(childRowId)_\(requestId)"]
    XCTAssertTrue(
      row.waitForExistence(timeout: 10),
      "The request created by this device should appear under From you")
    XCTAssertTrue(
      scrollUntilHittable(row),
      "The request row should be reachable after scrolling")
    row.swipeLeft(velocity: .slow)

    let swipeButtonId = "swipeLeft_\(childRowId)_\(requestId)"
    let swipeButton = app.buttons[swipeButtonId]
    XCTAssertTrue(
      swipeButton.waitForExistence(timeout: 3),
      "The sender should be offered cancel")
    XCTAssertEqual(swipeButton.label, "Cancel")
    XCTAssertEqual(
      app.buttons.matching(identifier: swipeButtonId).count,
      1,
      "The From you row should reveal exactly one declarative action")

    XCTAssertTrue(
      swipeButton.isHittable,
      "The revealed Cancel action should accept taps"
    )
    swipeButton.tap()
    XCTAssertTrue(
      row.waitForNonExistence(timeout: 5),
      "Cancel should optimistically remove the request from From you"
    )

    let cancelled = try awaitResult("wait for cancel response") {
      try await self.waitForMessageResponse(
        emitter: emitter,
        messageId: requestId,
        value: "cancel"
      )
    }
    XCTAssertTrue(cancelled, "Cancel should persist a response naming the request")
    try awaitResult("disconnect sender emitter") { await emitter.disconnect() }
  }

  @MainActor
  func testAskToBuyCreatesShippingRequestAndValidatesEmptyPostcode() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")
    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Shipping request item",
      pickupSelection: ["2026-06-03T09:00:00"],
      shippingFee: "0"
    )

    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: "Request shipping",
      itemId: selectedItemId,
      buttonExistenceMessage: "Request view button should load"
    )
    try await emitter.subscribe(event: "data_changed")

    let askToBuyButton = app.buttons["Ask to buy"]
    XCTAssertTrue(
      askToBuyButton.waitForExistence(timeout: 10), "Ask to buy button should be visible")
    askToBuyButton.tap()

    let missingInformationAlert = app.alerts["Missing information"]
    XCTAssertTrue(
      missingInformationAlert.waitForExistence(timeout: 5),
      "An empty shipping postcode should show the missing-information alert"
    )
    let messagesAfterEmptyPostcode = try await emitter.getResource(
      resource: EVYCoreResource.messages.ref
    )
    XCTAssertFalse(
      Self.messagesContain(
        messagesAfterEmptyPostcode,
        type: "shipping",
        itemId: selectedItemId
      ),
      "An empty postcode must not create a shipping request"
    )
    let dismissAlertButton = missingInformationAlert.buttons.firstMatch
    XCTAssertTrue(dismissAlertButton.exists, "Missing-information alert should be dismissible")
    dismissAlertButton.tap()

    try fillShippingPostcodeAndAskToBuy()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Shipping confirmation sheet should appear after Ask to buy with a postcode")
    tapConfirmationSheetRequestButton()

    let shippingRequestCreated = try await waitForMessage(
      emitter: emitter,
      type: "shipping",
      itemId: selectedItemId,
      valueKey: "postalcode",
      value: "2018"
    )
    XCTAssertTrue(
      shippingRequestCreated,
      "Ask to buy should create a shipping request with the entered postcode"
    )
    await emitter.disconnect()
  }

  /// Requests shipping for a freshly created item and asserts which surcharge-aware copy
  /// appears in the confirmation sheet.
  @MainActor
  private func assertShippingConfirmationCopy(
    emitter: WSEmitter,
    titlePrefix: String,
    shippingFee: String,
    viewLabelPrefix: String,
    expectedCopy: String,
    expectedMessage: String,
    absentCopy: String,
    absentMessage: String,
    file: StaticString = #filePath,
    line: UInt = #line
  ) async throws {
    let (itemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: titlePrefix,
      pickupSelection: ["2026-06-03T09:00:00"],
      shippingFee: shippingFee
    )
    _ = try await openViewItemPage(
      emitter: emitter,
      labelPrefix: viewLabelPrefix,
      itemId: itemId
    )

    try fillShippingPostcodeAndAskToBuy()

    XCTAssertTrue(
      waitForConfirmationSheet(timeout: 5),
      "Shipping confirmation sheet should open", file: file, line: line)
    XCTAssertTrue(
      app.staticTexts.containing(
        NSPredicate(format: "label CONTAINS %@", expectedCopy)
      ).firstMatch.waitForExistence(timeout: 5),
      expectedMessage, file: file, line: line)
    XCTAssertFalse(
      app.staticTexts.containing(
        NSPredicate(format: "label CONTAINS %@", absentCopy)
      ).firstMatch.waitForExistence(timeout: 2),
      absentMessage, file: file, line: line)
  }

  @MainActor
  func testShippingConfirmationSheetShowsSurchargeAwareCopy() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let heldPaymentCopy =
      "Your payment will be held on EVY until shipping has been confirmed (within 48 hours)."
    let noSurchargeCopy =
      "Shipping should be confirmed within 48 hours by the seller."

    try await assertShippingConfirmationCopy(
      emitter: emitter,
      titlePrefix: "Surcharge shipping item",
      shippingFee: "5",
      viewLabelPrefix: "Surcharge shipping",
      expectedCopy: heldPaymentCopy,
      expectedMessage: "Surcharge item confirmation should show the held-payment notice",
      absentCopy: noSurchargeCopy,
      absentMessage: "Surcharge item confirmation should not show the no-surcharge notice"
    )

    dismissConfirmationSheet()
    XCTAssertTrue(
      waitForConfirmationSheetDismissed(timeout: 5),
      "Shipping confirmation sheet should dismiss")

    try await assertShippingConfirmationCopy(
      emitter: emitter,
      titlePrefix: "Free shipping item",
      shippingFee: "0",
      viewLabelPrefix: "Free shipping",
      expectedCopy: noSurchargeCopy,
      expectedMessage: "No-surcharge item confirmation should show the 48-hour notice",
      absentCopy: heldPaymentCopy,
      absentMessage: "No-surcharge item confirmation should not show the held-payment notice"
    )
    await emitter.disconnect()
  }

  @MainActor
  func testViewItemPaymentRowsRespectVisiblePredicate() async throws {
    let viewItemButton = app.buttons["View"]
    XCTAssertTrue(
      viewItemButton.waitForExistence(timeout: 20),
      "Home screen not loaded - verify API is running and database is seeded")

    let emitter = WSEmitter()
    try await emitter.connect(host: apiHost)
    try await emitter.login(token: "e2e-test", os: "ios")

    let (selectedItemId, _) = try await createMarketplaceItem(
      emitter: emitter,
      titlePrefix: "Payment Item",
      paymentMethods: ["cash": true, "app": false]
    )

    let viewButtonLabel = "View payment \(Int(Date().timeIntervalSince1970))"
    try await emitter.updateSDUI(
      flowData: createHomeFlowData(
        buttonLabel: viewButtonLabel,
        viewItemId: selectedItemId
      ),
      flowId: E2EFlowIds.webSocketHomeFlow
    )
    try await emitter.updateSDUI(
      flowData: Self.viewItemFlowData(
        flowId: E2EFlowIds.webSocketViewFlow,
        pageId: E2EFlowIds.webSocketViewPage
      ),
      flowId: E2EFlowIds.webSocketViewFlow
    )
    await emitter.disconnect()

    app.terminate()
    try launchApp()

    let queryButton = app.buttons[viewButtonLabel]
    XCTAssertTrue(
      queryButton.waitForExistence(timeout: 20),
      "Home view button should load with query-aware label after relaunch")

    queryButton.tap()

    let scrollView = app.scrollViews.firstMatch
    XCTAssertTrue(scrollView.waitForExistence(timeout: 10), "View item page should appear")

    XCTAssertTrue(
      app.staticTexts["Cash accepted"].waitForExistence(timeout: 10),
      "Cash payment row should be visible when \(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.cash is true"
    )
    XCTAssertFalse(
      app.staticTexts["App payments accepted"].waitForExistence(timeout: 2),
      "App payment row should be hidden when \(MARKETPLACE_ITEMS_RESOURCE_ID).payment_methods.app is false"
    )
  }

  @MainActor
  private func waitForCancelRequestVisible(timeout: TimeInterval) -> Bool {
    let labels = ["pickup", "delivery", "shipping"].map { Self.cancelRequestButtonLabel(type: $0) }
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if labels.contains(where: { app.buttons[$0].exists }) {
        return true
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
    return labels.contains { app.buttons[$0].exists }
  }

  @MainActor
  private func waitForCancelRequestHidden(timeout: TimeInterval) -> Bool {
    let labels = ["pickup", "delivery", "shipping"].map { Self.cancelRequestButtonLabel(type: $0) }
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if labels.allSatisfy({ !app.buttons[$0].exists }) {
        return true
      }
      RunLoop.current.run(until: Date().addingTimeInterval(0.2))
    }
    return labels.allSatisfy { !app.buttons[$0].exists }
  }

  private func waitForMessage(
    emitter: WSEmitter,
    type: String? = nil,
    itemId: String,
    valueKey: String? = nil,
    value: String? = nil
  ) async throws -> Bool {
    try await waitForResourceUpdate(
      emitter: emitter, resource: EVYCoreResource.messages.ref
    ) {
      Self.messagesContain(
        $0,
        type: type,
        itemId: itemId,
        valueKey: valueKey,
        value: value
      )
    }
  }

  private static func messagesContain(
    _ messages: Any,
    type: String? = nil,
    itemId: String,
    valueKey: String? = nil,
    value: String? = nil
  ) -> Bool {
    guard let messageRows = responseDataArray(from: messages) else { return false }
    return messageRows.contains { message in
      guard let messageData = message as? [String: Any],
        messageData["fk"] as? String == itemId,
        let messageDetails = messageData["data"] as? [String: Any]
      else {
        return false
      }
      if let type, messageDetails["type"] as? String != type {
        return false
      }
      guard let valueKey, let value else { return true }
      return messageDetails[valueKey] as? String == value
    }
  }
  @MainActor
  func fillShippingPostcodeAndAskToBuy(postcode: String = "2018") throws {
    let postcodeContainer = try XCTUnwrap(
      findElement(identifier: "textField_{shipping_address.postcode}"),
      "Shipping postcode input should be visible"
    )
    let editablePostcodeField = tapAndGetEditableField(container: postcodeContainer)
    let postcodeField = try XCTUnwrap(editablePostcodeField)
    clearAndType(field: postcodeField, text: postcode, placeholder: "Postcode")
    dismissKeyboard()
    app.buttons["Ask to buy"].tap()
  }

}
