//
//  EVYSearchTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYSearchTests: XCTestCase {
  func testClassifySourceDetectsApiBackedSources() {
    XCTAssertEqual(
      EVY.classifySource("{$api:place_search}"),
      .api(method: "place_search")
    )
    XCTAssertEqual(
      EVY.classifySource("$api:place_search"),
      .api(method: "place_search")
    )
  }

  func testClassifySourceDetectsLocalSources() {
    XCTAssertEqual(
      EVY.classifySource("{item.results}"),
      .local(props: "item.results")
    )
    XCTAssertEqual(
      EVY.classifySource("items"),
      .local(props: "items")
    )
  }

  func testEVYSearchRequestEncodesInputOnly() throws {
    let encoded = try JSONEncoder().encode(EVYSearchRequest(input: "28 Rothschild"))
    let json = try JSONSerialization.jsonObject(with: encoded) as? [String: String]
    XCTAssertEqual(json, ["input": "28 Rothschild"])
  }
}
