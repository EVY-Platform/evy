//
//  EVYSearchTests.swift
//  evyTests
//

import XCTest

@testable import evy

final class EVYSearchTests: XCTestCase {
  func testParseSearchSourceDetectsApiBackedSources() {
    XCTAssertEqual(
      EVYSearchSource.parse("{$api:place_search}"),
      .api(method: "place_search")
    )
  }

  func testParseSearchSourceDetectsLocalSources() {
    XCTAssertEqual(
      EVYSearchSource.parse("{items}"),
      .local(expression: "items")
    )
  }

  func testQueryDispatchSkipsEmptyInput() {
    XCTAssertEqual(
      EVYSearchQueryDispatch.decision(trimmedQuery: "", lastEnteredCharacter: nil),
      .skip
    )
  }

  func testQueryDispatchSchedulesDebounceForNonWhitespaceInput() {
    XCTAssertEqual(
      EVYSearchQueryDispatch.decision(trimmedQuery: "hello", lastEnteredCharacter: "o"),
      .scheduleDebounce
    )
  }

  func testQueryDispatchFiresImmediatelyOnWhitespace() {
    XCTAssertEqual(
      EVYSearchQueryDispatch.decision(trimmedQuery: "hello", lastEnteredCharacter: " "),
      .dispatchNow
    )
  }

  func testAPISearchPayloadUsesLocaleDefaultsWithFallbacks() {
    let payload = APISearchPayload.fromCurrentLocale(input: "28 Rothschild")
    XCTAssertEqual(payload.input, "28 Rothschild")
    XCTAssertFalse(payload.language.isEmpty)
    XCTAssertFalse(payload.region.isEmpty)
  }
}
