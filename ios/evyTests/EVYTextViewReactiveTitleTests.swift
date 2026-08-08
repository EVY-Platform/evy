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

  func testReactiveTitleRecomputesAcrossConstructionPaths() throws {
    let (key, scopeId) = try seedReactiveTitle()

    let boldView = EVYTextView("{\(key)}", style: .bodyBold)
    let boldInitial = boldView.toString()
    XCTAssertTrue(
      boldInitial.contains("Initial"),
      "Bold title should resolve the seeded value on init, got: '\(boldInitial)'"
    )

    let state = EVYTextView.makeState(template: "{\(key)}")
    let stateInitial = state.value.toString()
    XCTAssertTrue(
      stateInitial.contains("Initial"),
      "makeState should resolve the seeded value on init, got: '\(stateInitial)'"
    )

    let stateView = EVYTextView(state: state, style: .title)
    let stateViewInitial = stateView.toString()
    XCTAssertTrue(
      stateViewInitial.contains("Initial"),
      "init(state:) should resolve the seeded value, got: '\(stateViewInitial)'"
    )

    try EVY.writeRawStringValue("Updated", to: "{\(key)}", scopeId: scopeId)

    let boldUpdated = boldView.toString()
    XCTAssertTrue(
      boldUpdated.contains("Updated"),
      "Bold title must recompute when the watched value changes, got: '\(boldUpdated)'"
    )
    XCTAssertNotEqual(boldInitial, boldUpdated)

    let stateUpdated = state.value.toString()
    XCTAssertTrue(
      stateUpdated.contains("Updated"),
      "makeState must recompute when the watched value changes, got: '\(stateUpdated)'"
    )

    let stateViewUpdated = stateView.toString()
    XCTAssertTrue(
      stateViewUpdated.contains("Updated"),
      "init(state:) must recompute when the shared state changes, got: '\(stateViewUpdated)'"
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

  /// A state built for a specific page must resolve that page's cache even
  /// when another page owns the globals at construction time.
  func testMakeStatePinsThePassedScopeOverTheActiveGlobal() throws {
    let ownScopeId = "own-\(UUID().uuidString)"
    let activeScopeId = "active-\(UUID().uuidString)"
    let key = "scoped_title"

    for (scopeId, label) in [(ownScopeId, "own-page"), (activeScopeId, "active-page")] {
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
    let state = EVYTextView.makeState(
      template: "{\(key).label}",
      scope: EVYScope(cacheScopeId: ownScopeId, draftScopeId: nil)
    )

    XCTAssertEqual(state.value.toString(), "own-page")
    XCTAssertEqual(EVY.activeCacheScopeId, activeScopeId)
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
