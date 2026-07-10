//
//  EVYDataPatcherTests.swift
//  evyTests
//

import XCTest

@testable import evy

final class EVYDataPatcherTests: XCTestCase {
  func testPatchCreatesMissingIntermediateDictionaries() throws {
    let current = EVYJson.dictionary(["title": .string("x")])
    let address = EVYJson.dictionary([
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "latitude": .decimal(-33.9172075),
      "longitude": .decimal(151.1985883),
    ])

    let patchedData = try EVYDataPatcher.patch(
      encodedData: try JSONEncoder().encode(current),
      newData: try JSONEncoder().encode(address),
      props: ["transfer_options", "pickup", "address"]
    )

    let result = try JSONDecoder().decode(EVYJson.self, from: patchedData)
    guard case .dictionary(let root) = result else {
      XCTFail("expected dictionary root")
      return
    }
    XCTAssertEqual(root["title"], .string("x"))
    guard case .dictionary(let transferOptions)? = root["transfer_options"] else {
      XCTFail("expected transfer_options dictionary")
      return
    }
    guard case .dictionary(let pickup)? = transferOptions["pickup"] else {
      XCTFail("expected pickup dictionary")
      return
    }
    XCTAssertEqual(pickup["address"], address)
  }
}
