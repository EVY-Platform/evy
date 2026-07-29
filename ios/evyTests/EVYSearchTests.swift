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

  func testSearchDestinationValueStripsIdAndPreservesInstructions() throws {
    let scopeId = EVYDraft.ephemeralScopeId(forPageId: UUID().uuidString)
    EVY.draftStore.activeScopeId = scopeId
    defer {
      EVY.draftStore.deleteDrafts()
      EVY.draftStore.activeScopeId = nil
    }

    try EVY.writeRawValue(
      .dictionary([
        "street": .string("Old Street"),
        "instructions": .string("Leave at front door"),
      ]),
      to: "{pickup_address}"
    )

    let selected = EVYJson.dictionary([
      "id": .string("google-place-id"),
      "street": .string("1 Martin Place"),
      "city": .string("Sydney"),
    ])
    let written = EVY.searchDestinationValue(from: selected, destination: "{pickup_address}")
    guard case .dictionary(let fields) = written else {
      return XCTFail("expected dictionary")
    }
    XCTAssertNil(fields["id"])
    XCTAssertEqual(fields["street"], .string("1 Martin Place"))
    XCTAssertEqual(fields["city"], .string("Sydney"))
    XCTAssertEqual(fields["instructions"], .string("Leave at front door"))
  }
}
