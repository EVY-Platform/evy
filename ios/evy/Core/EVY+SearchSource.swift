//
//  EVY+SearchSource.swift
//  evy
//

import Foundation

enum EVYSearchSource: Equatable {
  case local(expression: String)
  case api(method: String)

  private static let apiPrefixWithSeparator = "$api:"

  static func parse(_ source: String) -> EVYSearchSource {
    var expression = source.trimmingCharacters(in: .whitespacesAndNewlines)
    if expression.hasPrefix("{"), expression.hasSuffix("}") {
      expression = String(expression.dropFirst().dropLast())
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    let apiMethod = stripApiPrefix(expression)
    if apiMethod != expression {
      return .api(method: apiMethod)
    }

    return .local(expression: expression)
  }

  private static func stripApiPrefix(_ props: String) -> String {
    guard props.hasPrefix(apiPrefixWithSeparator) else {
      return props
    }
    return String(props.dropFirst(apiPrefixWithSeparator.count))
  }
}

struct APISearchPayload: Encodable {
  let input: String
  let language: String
  let region: String

  static func fromCurrentLocale(input: String) -> APISearchPayload {
    // The place search API requires a BCP-47 language tag (e.g. "en-US"), not the
    // ICU identifier format ("en_US") returned by `Locale.current.identifier`.
    let bcp47Language = Locale.current.identifier(.bcp47)
    let language = bcp47Language.isEmpty ? "en-AU" : bcp47Language
    let region = Locale.current.region?.identifier.lowercased() ?? "au"
    return APISearchPayload(input: input, language: language, region: region)
  }
}
