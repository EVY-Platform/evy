//
//  EVYDatumRowFormatter.swift
//  evy
//
//  Created by Geoffroy Lesage on 22/8/2024.
//

import Foundation

// MARK: - Datum Row Template Formatting
private func deepCopyJSONValue(_ value: Any) -> Any {
  switch value {
  case let d as [String: Any]:
    var out: [String: Any] = [:]
    out.reserveCapacity(d.count)
    for (k, v) in d {
      out[k] = deepCopyJSONValue(v)
    }
    return out
  case let a as [Any]:
    return a.map { deepCopyJSONValue($0) }
  default:
    return value
  }
}

@MainActor
final class EVYDatumRowFormatter {
  private let rootPrototype: [String: Any]
  private static let displayKeys = [
    "title", "subtitle", "text", "label", "placeholder", "value",
  ]

  private static let datumReferenceRegex = try! NSRegularExpression(
    pattern: #"\{\$datum:([A-Za-z0-9_.-]+)\}"#
  )

  private static func datumValue(path: String, datum: EVYJson) -> String {
    let pathSegments = path.split(separator: ".").map(String.init)
    if pathSegments.isEmpty {
      return datum.toString()
    }

    var currentValue = datum
    for pathSegment in pathSegments {
      switch currentValue {
      case .dictionary(let dictionaryValue):
        guard let nextValue = dictionaryValue[pathSegment] else {
          return ""
        }
        currentValue = nextValue
      case .array(let arrayValue):
        guard let index = Int(pathSegment), arrayValue.indices.contains(index) else {
          return ""
        }
        currentValue = arrayValue[index]
      default:
        return ""
      }
    }

    return currentValue.toString()
  }

  private static func formatDatumReferences(_ template: String, datum: EVYJson) -> String {
    var formattedTemplate = template
    let templateRange = NSRange(template.startIndex..., in: template)
    let matches = datumReferenceRegex.matches(in: template, range: templateRange)

    for match in matches.reversed() {
      guard let fullRange = Range(match.range, in: formattedTemplate),
        let pathRange = Range(match.range(at: 1), in: formattedTemplate)
      else {
        continue
      }

      let path = String(formattedTemplate[pathRange])
      formattedTemplate.replaceSubrange(
        fullRange,
        with: datumValue(path: path, datum: datum)
      )
    }

    return formattedTemplate
  }

  private static func formatDatumReferencesInJSONValue(_ value: Any, datum: EVYJson) -> Any {
    switch value {
    case let stringValue as String:
      return formatDatumReferences(stringValue, datum: datum)
    case let dictionaryValue as [String: Any]:
      return dictionaryValue.mapValues { nestedValue in
        formatDatumReferencesInJSONValue(nestedValue, datum: datum)
      }
    case let arrayValue as [Any]:
      return arrayValue.map { nestedValue in
        formatDatumReferencesInJSONValue(nestedValue, datum: datum)
      }
    default:
      return value
    }
  }

  init(template: UI_Row) throws {
    let data = try JSONEncoder().encode(template)
    guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw EVYDatumRowFormattingError.invalidTemplate
    }
    rootPrototype = root
  }

  func formattedResult(datum: EVYJson) throws -> (row: UI_Row, value: String) {
    guard
      var root = Self.formatDatumReferencesInJSONValue(
        deepCopyJSONValue(rootPrototype),
        datum: datum
      ) as? [String: Any],
      let view = root["view"] as? [String: Any],
      let content = view["content"] as? [String: Any]
    else {
      throw EVYDatumRowFormattingError.invalidTemplate
    }
    let value =
      Self.displayKeys
      .compactMap { content[$0] as? String }
      .first(where: { !$0.isEmpty }) ?? ""
    root["id"] = UUID().uuidString
    let out = try JSONSerialization.data(withJSONObject: root)
    return (try JSONDecoder().decode(UI_Row.self, from: out), value)
  }
}

enum EVYDatumRowFormattingError: Error {
  case invalidTemplate
}
