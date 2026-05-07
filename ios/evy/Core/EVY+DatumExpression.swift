//
//  EVY+DatumExpression.swift
//  evy
//
//  Created on 15/6/2024.
//

import Foundation

// MARK: - Central $datum Expression Parsing

extension EVY {
  static let datumPrefix = "$datum"
  static let datumPrefixWithColon = "$datum:"
  static let datumPrefixWithDot = "$datum."

  @MainActor
  static func resolveDatumExpression(_ expression: String, in datum: EVYJson) -> String {
    let fieldPath: String
    if expression.hasPrefix(datumPrefixWithDot) {
      fieldPath = String(expression.dropFirst(datumPrefixWithDot.count))
    } else if expression.hasPrefix(datumPrefixWithColon) {
      fieldPath = String(expression.dropFirst(datumPrefixWithColon.count))
    } else {
      return expression
    }

    guard !fieldPath.isEmpty else { return expression }

    let props = fieldPath.split(separator: ".").map(String.init)
    let resolved = datum.parseProp(props: props)
    let result = resolved.identifierValue()
    return result.isEmpty ? expression : result
  }

  @MainActor
  static func resolveDatumInQuery(_ query: [String: [String]], datum: EVYJson?) -> [String: [String]] {
    guard let datum else { return query }

    var resolved: [String: [String]] = [:]
    for (key, values) in query {
      resolved[key] = values.map { resolveDatumExpression($0, in: datum) }
    }
    return resolved
  }
}
