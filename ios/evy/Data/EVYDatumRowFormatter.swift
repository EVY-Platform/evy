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

  private static func resolveDatumReferences(in stringValue: String, datum: EVYJson) -> String {
    guard stringValue.contains("$datum:") else { return stringValue }
    return (try? _formatData(json: datum, format: stringValue)) ?? stringValue
  }

  private static func formatDatumReferencesInJSONValue(_ value: Any, datum: EVYJson) -> Any {
    switch value {
    case let stringValue as String:
      return resolveDatumReferences(in: stringValue, datum: datum)
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

  func formattedResult(datum: EVYJson) throws -> (row: UI_Row, searchableValues: [String]) {
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
    let searchableValues =
      Self.displayKeys
      .compactMap { content[$0] as? String }
      .filter { !$0.isEmpty }
    root["id"] = UUID().uuidString
    let out = try JSONSerialization.data(withJSONObject: root)
    return (try JSONDecoder().decode(UI_Row.self, from: out), searchableValues)
  }
}

enum EVYDatumRowFormattingError: Error {
  case invalidTemplate
}
