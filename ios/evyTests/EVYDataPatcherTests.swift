//
//  EVYDataPatcherTests.swift
//  evyTests
//

import XCTest

@testable import evy

final class EVYDataPatcherTests: XCTestCase {
  func testPatchCreatesMissingIntermediateDictionaries() throws {
    let current = EVYJson.dictionary(["title": .string("x")])
    let addressId = EVYJson.string(UUID().uuidString)

    let patchedData = try EVYDataPatcher.patch(
      encodedData: try JSONEncoder().encode(current),
      newData: try JSONEncoder().encode(addressId),
      props: ["transfer_options", "pickup", "address_id"]
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
    XCTAssertEqual(pickup["address_id"], addressId)
  }

  /// Regression: a JSON `null` anywhere in a synced payload used to fail EVYJson
  /// decoding entirely, which aborted the whole sync and left the app unable to
  /// load flows. Nulls must decode, re-encode as null, and read as empty strings.
  func testJsonNullDecodesAndRoundTrips() throws {
    let payload = """
      {"data":[{"service":"s","resource":"r","value":[
        {"id":"req-1","fk":"item-1","archivedAt":null,"data":{"type":"shipping"}}
      ]}]}
      """
    let decoded = try JSONDecoder().decode(SyncResponse.self, from: Data(payload.utf8))

    guard case .array(let rows) = decoded.data[0].value,
      case .dictionary(let message) = rows[0]
    else {
      return XCTFail("expected synced message dictionary")
    }
    XCTAssertEqual(message["archivedAt"], EVYJson.null)
    XCTAssertEqual(message["archivedAt"]?.toString(), "")

    let reencoded = try JSONEncoder().encode(message)
    let json =
      try JSONSerialization.jsonObject(with: reencoded) as? [String: Any]
    XCTAssertTrue(json?["archivedAt"] is NSNull, "null should round-trip as JSON null")
  }
}
