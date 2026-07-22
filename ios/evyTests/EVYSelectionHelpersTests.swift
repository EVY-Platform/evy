//
//  EVYSelectionHelpersTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYSelectionHelpersTests: XCTestCase {
  func testToggledIdentifiersEmptyBatchIsNoOp() {
    let selections = ["a", "b"]
    XCTAssertEqual(
      EVYSelectionHelpers.toggledIdentifiers([], in: selections),
      selections
    )
  }

  func testToggledIdentifiersNonePresentAddsAll() {
    XCTAssertEqual(
      EVYSelectionHelpers.toggledIdentifiers(["a", "b"], in: []),
      ["a", "b"]
    )
  }

  func testToggledIdentifiersPartiallyPresentAddsMissingOnly() {
    XCTAssertEqual(
      EVYSelectionHelpers.toggledIdentifiers(["a", "b", "c"], in: ["a"]),
      ["a", "b", "c"]
    )
  }

  func testToggledIdentifiersAllPresentRemovesAll() {
    XCTAssertEqual(
      EVYSelectionHelpers.toggledIdentifiers(["a", "b"], in: ["a", "b", "c"]),
      ["c"]
    )
  }
}
