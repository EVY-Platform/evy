//
//  EVYTextViewReactiveTitleTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYTextViewReactiveTitleTests: XCTestCase {
  override func tearDownWithError() throws {
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    try super.tearDownWithError()
  }

  func testBoldTitleRecomputesWhenWatchedValueChanges() throws {
    let (key, scopeId) = try seedReactiveTitle()

    let view = EVYTextView("{\(key)}", style: .bodyBold)
    let initial = view.toString()
    XCTAssertTrue(
      initial.contains("Initial"),
      "Bold title should resolve the seeded value on init, got: '\(initial)'"
    )

    try EVY.writeRawStringValue("Updated", to: "{\(key)}", scopeId: scopeId)

    let updated = view.toString()
    XCTAssertTrue(
      updated.contains("Updated"),
      "Bold title must recompute when the watched value changes (realtime update), got: '\(updated)'"
    )
    XCTAssertNotEqual(
      initial,
      updated,
      "Bold title must change after the watched value changes"
    )
  }

  func testBoldAndNonBoldTitleResolveSameBinding() throws {
    let (key, _) = try seedReactiveTitle(initial: "Shared")

    let bold = EVYTextView("{\(key)}", style: .bodyBold)
    let regular = EVYTextView("{\(key)}", style: .body)

    XCTAssertEqual(
      bold.toString(),
      regular.toString(),
      "Bold and non-bold titles bound to the same value must resolve identically"
    )
    XCTAssertTrue(
      bold.toString().contains("Shared"),
      "Bold title should resolve the shared value, got: '\(bold.toString())'"
    )
  }

  func testMakeStateRecomputesWhenWatchedValueChanges() throws {
    let (key, scopeId) = try seedReactiveTitle()

    let state = EVYTextView.makeState(template: "{\(key)}")
    let initial = state.value.toString()
    XCTAssertTrue(
      initial.contains("Initial"),
      "makeState should resolve the seeded value on init, got: '\(initial)'"
    )

    try EVY.writeRawStringValue("Updated", to: "{\(key)}", scopeId: scopeId)

    let updated = state.value.toString()
    XCTAssertTrue(
      updated.contains("Updated"),
      "makeState must recompute when the watched value changes, got: '\(updated)'"
    )
  }

  func testInitWithStateRendersSharedInstance() throws {
    let (key, scopeId) = try seedReactiveTitle()

    let state = EVYTextView.makeState(template: "{\(key)}")
    let view = EVYTextView(state: state, style: .title)
    let initial = view.toString()
    XCTAssertTrue(
      initial.contains("Initial"),
      "init(state:) should resolve the seeded value, got: '\(initial)'"
    )

    try EVY.writeRawStringValue("Updated", to: "{\(key)}", scopeId: scopeId)

    let updated = view.toString()
    XCTAssertTrue(
      updated.contains("Updated"),
      "init(state:) must recompute when the shared state changes, got: '\(updated)'"
    )
  }

  func testButtonLabelParsesQuotedFormatDatetimeExpression() throws {
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: UUID().uuidString)
    EVY.draftStore.activeScopeId = scopeId

    EVY.ensureDraftExists(variableName: "selected_pickup_timeslot", scopeId: scopeId)
    try EVY.updateValue(
      "2026-06-03T10:00:00",
      destination: "{selected_pickup_timeslot}",
      scopeId: scopeId
    )

    let label = "Request {formatDatetime(selected_pickup_timeslot, \"HH:mm\")}"
    let view = EVYTextView(label, style: .button)

    XCTAssertEqual(
      view.toString(),
      "Request 10:00",
      "Button labels with quoted formatDatetime args must resolve, not render the raw expression"
    )
  }

  private func seedReactiveTitle(
    initial: String = "Initial"
  ) throws -> (key: String, scopeId: String) {
    let key = uniqueKey("title")
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: UUID().uuidString)
    EVY.draftStore.activeScopeId = scopeId
    try EVY.writeRawStringValue(initial, to: "{\(key)}", scopeId: scopeId)
    return (key, scopeId)
  }
}
