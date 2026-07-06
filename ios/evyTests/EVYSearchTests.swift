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

  func testAPISearchPayloadUsesLocaleDefaultsWithFallbacks() {
    let payload = APISearchPayload.fromCurrentLocale(input: "28 Rothschild")
    XCTAssertEqual(payload.input, "28 Rothschild")
    XCTAssertFalse(payload.language.isEmpty)
    XCTAssertFalse(payload.region.isEmpty)
  }
}
