import XCTest

@testable import evy

final class EVYPaymentSignatureTests: XCTestCase {
  func testGoldenHashMatchesTypeScript() {
    let hash = EVYPaymentSignature.computeHash(
      amount: 250,
      currency: "AUD",
      authorizationMessageId: "95a6a85b-e289-471c-b7fe-440ec2dfa2dc",
      createdAt: "2026-08-02T00:03:30",
      paymentProvider: "stripe",
      last4: "4242"
    )
    XCTAssertEqual(
      hash,
      "890787ccab9ec8eee374a6fa0ac834b3284663b47704662edd3a7e64cdf57d94"
    )
  }

  func testAmount250And250Point0CanonicalizeIdentically() {
    let left = EVYPaymentSignature.computeHash(
      amount: 250,
      currency: "AUD",
      authorizationMessageId: "95a6a85b-e289-471c-b7fe-440ec2dfa2dc",
      createdAt: "2026-08-02T00:03:30",
      paymentProvider: "stripe",
      last4: "4242"
    )
    let right = EVYPaymentSignature.computeHash(
      amount: 250.0,
      currency: "AUD",
      authorizationMessageId: "95a6a85b-e289-471c-b7fe-440ec2dfa2dc",
      createdAt: "2026-08-02T00:03:30",
      paymentProvider: "stripe",
      last4: "4242"
    )
    XCTAssertEqual(left, right)
  }

  func testFinalizeReplacesMarkerWithFullSignature() {
    let marker = EVYJson.string(
      EVYPaymentSignature.markerJSON(amount: 250, currency: "AUD"))
    let messageId = "95a6a85b-e289-471c-b7fe-440ec2dfa2dc"
    let createdAt = "2026-08-02T00:03:30"
    guard
      let finalized = EVYPaymentSignature.finalize(
        marker: marker,
        messageId: messageId,
        createdAt: createdAt
      )
    else {
      return XCTFail("expected finalize to succeed")
    }
    guard case .dictionary(let root) = finalized,
      case .dictionary(let data) = root["data"],
      case .string(let hash) = root["hash"]
    else {
      return XCTFail("unexpected signature shape")
    }
    XCTAssertEqual(hash, "890787ccab9ec8eee374a6fa0ac834b3284663b47704662edd3a7e64cdf57d94")
    XCTAssertEqual(data["authorization_message_id"], .string(messageId))
    XCTAssertEqual(data["created_at"], .string(createdAt))
    XCTAssertEqual(data["payment_provider"], .string("stripe"))
    XCTAssertEqual(
      data["payment_method_last_4_characters"],
      .string(EVYPaymentSignature.placeholderCardLast4))
    XCTAssertEqual(data["currency"], .string("AUD"))
  }
}
