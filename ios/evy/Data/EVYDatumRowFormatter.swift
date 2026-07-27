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

  private static func extractAllStrings(from value: Any) -> [String] {
    switch value {
    case let stringValue as String:
      return [stringValue]
    case let dictionaryValue as [String: Any]:
      return dictionaryValue.values.flatMap { extractAllStrings(from: $0) }
    case let arrayValue as [Any]:
      return arrayValue.flatMap { extractAllStrings(from: $0) }
    default:
      return []
    }
  }

  private static func resolveDatumReferences(in stringValue: String, datum: EVYJson) -> String {
    guard EVY.containsDatumReference(stringValue) else { return stringValue }
    return (try? EVY.formatData(json: datum, format: stringValue)) ?? stringValue
  }

  private static func formatDatumReferencesInJSONValue(_ value: Any, datum: EVYJson) -> Any {
    switch value {
    case let stringValue as String:
      return resolveDatumReferences(in: stringValue, datum: datum)
    case let dictionaryValue as [String: Any]:
      var formatted: [String: Any] = [:]
      formatted.reserveCapacity(dictionaryValue.count)
      for (key, nestedValue) in dictionaryValue {
        // Action branches resolve $datum at run time. Running them through formatData
        // replaces $datum with a temporary id that is cleared before the action executes,
        // which silently breaks filters like {id: $datum.id, status: "pending"}.
        if key == "actions" {
          formatted[key] = nestedValue
        } else {
          formatted[key] = formatDatumReferencesInJSONValue(nestedValue, datum: datum)
        }
      }
      return formatted
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
      let root = Self.formatDatumReferencesInJSONValue(
        deepCopyJSONValue(rootPrototype),
        datum: datum
      ) as? [String: Any]
    else {
      throw EVYDatumRowFormattingError.invalidTemplate
    }
    let searchableValues =
      Self.extractAllStrings(from: root)
      .filter { !$0.isEmpty }
    // Keep the template row id. Search results are identified by datum id, and swipe
    // identity is `templateId_datumId` — replacing this with a random UUID breaks
    // accessibility ids and one-open-at-a-time coordination against authored row ids.
    let out = try JSONSerialization.data(withJSONObject: root)
    return (try JSONDecoder().decode(UI_Row.self, from: out), searchableValues)
  }
}

enum EVYDatumRowFormattingError: Error {
  case invalidTemplate
}
