import CryptoKit
import Foundation

enum EVYPaymentSignature {
  static let pendingMarkerKey = "evy_pending_payment_signature"
  static let placeholderCardLast4 = "4242"
  private static let versionPrefix = "evy-txn-sig-v1"

  static func formatAmount(_ amount: Double) -> String {
    String(format: "%.2f", amount)
  }

  static func canonicalString(
    amount: Double,
    currency: String,
    authorizationMessageId: String,
    createdAt: String,
    paymentProvider: String,
    last4: String
  ) -> String {
    [
      versionPrefix,
      formatAmount(amount),
      currency,
      authorizationMessageId,
      createdAt,
      paymentProvider,
      last4,
    ].joined(separator: "\n")
  }

  static func computeHash(
    amount: Double,
    currency: String,
    authorizationMessageId: String,
    createdAt: String,
    paymentProvider: String,
    last4: String
  ) -> String {
    let canonical = canonicalString(
      amount: amount,
      currency: currency,
      authorizationMessageId: authorizationMessageId,
      createdAt: createdAt,
      paymentProvider: paymentProvider,
      last4: last4
    )
    let digest = SHA256.hash(data: Data(canonical.utf8))
    return digest.map { String(format: "%02x", $0) }.joined()
  }

  static func markerJSON(amount: Double, currency: String) -> String {
    let amountLiteral: String
    if amount.truncatingRemainder(dividingBy: 1) == 0, amount <= Double(Int.max),
      amount >= Double(Int.min)
    {
      amountLiteral = String(Int(amount))
    } else {
      amountLiteral = formatAmount(amount)
    }
    let escapedCurrency =
      currency
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")
    return
      "{\"\(pendingMarkerKey)\":{\"amount\":\(amountLiteral),\"currency\":\"\(escapedCurrency)\"}}"
  }

  static func pendingMarker(from json: EVYJson) -> (amount: Double, currency: String)? {
    guard case .string(let raw) = json else { return nil }
    return pendingMarker(from: raw)
  }

  static func pendingMarker(from raw: String) -> (amount: Double, currency: String)? {
    guard let data = raw.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let pending = object[pendingMarkerKey] as? [String: Any]
    else {
      return nil
    }
    let amountValue = pending["amount"]
    let amount: Double?
    if let number = amountValue as? Double {
      amount = number
    } else if let number = amountValue as? Int {
      amount = Double(number)
    } else if let number = amountValue as? NSNumber {
      amount = number.doubleValue
    } else {
      amount = nil
    }
    guard let amount,
      let currency = pending["currency"] as? String,
      !currency.isEmpty
    else {
      return nil
    }
    return (amount, currency)
  }

  static func finalize(
    marker: EVYJson,
    messageId: String,
    createdAt: String
  ) -> EVYJson? {
    guard let pending = pendingMarker(from: marker) else { return nil }
    let hash = computeHash(
      amount: pending.amount,
      currency: pending.currency,
      authorizationMessageId: messageId,
      createdAt: createdAt,
      paymentProvider: "stripe",
      last4: placeholderCardLast4
    )
    return .dictionary([
      "data": .dictionary([
        "amount": amountJson(pending.amount),
        "currency": .string(pending.currency),
        "authorization_message_id": .string(messageId),
        "created_at": .string(createdAt),
        "payment_provider": .string("stripe"),
        "payment_method_last_4_characters": .string(placeholderCardLast4),
      ]),
      "hash": .string(hash),
    ])
  }

  private static func amountJson(_ amount: Double) -> EVYJson {
    if amount.truncatingRemainder(dividingBy: 1) == 0, amount <= Double(Int.max),
      amount >= Double(Int.min)
    {
      return .int(Int(amount))
    }
    return .decimal(Decimal(string: formatAmount(amount)) ?? Decimal(amount))
  }
}
