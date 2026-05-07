//
//  EVY+DatumExpression.swift
//  evy
//
//  Created on 15/6/2024.
//

import Foundation

// MARK: - Central $datum Expression Parsing

extension EVY {
  static let datumPrefix = "$datum."

  @MainActor
  static func resolveDatumExpression(_ expression: String, in datum: EVYJson) -> String {
    guard expression.hasPrefix(datumPrefix) else { return expression }
    let fieldPath = String(expression.dropFirst(datumPrefix.count))
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
