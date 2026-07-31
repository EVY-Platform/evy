//
//  EVYObjectLiteral.swift
//  evy
//

import Foundation

/// An object-valued action argument: either written out inline, or a path to
/// read it from.
public enum EVYObjectArgument: Equatable {
  case literal([String: String])
  case path(String)
}

/// Reads the `{key: value, ...}` object literals that appear inside action
/// values, e.g. the nested object in `data: {type: pickup, time: {selected}}`.
@MainActor
enum EVYObjectLiteral {
  static func parse(from text: String, context: String) throws -> [String: String] {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("{"), trimmed.hasSuffix("}") else {
      throw EVYError.invalidData(context: "\(context) must be wrapped in {}")
    }

    let inner = String(trimmed.dropFirst().dropLast())
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !inner.isEmpty else { return [:] }

    var object: [String: String] = [:]
    for pair in EVY.splitFunctionArguments(inner) {
      guard let colonIndex = pair.firstIndex(of: ":") else {
        throw EVYError.invalidData(context: "\(context) must be key:value pairs")
      }

      let key = pair[..<colonIndex].trimmingCharacters(in: .whitespacesAndNewlines)
      let value = pair[pair.index(after: colonIndex)...]
        .trimmingCharacters(in: .whitespacesAndNewlines)
      guard !key.isEmpty, !value.isEmpty else {
        throw EVYError.invalidData(context: "\(context) must be key:value pairs")
      }
      object[key] = value
    }

    return object
  }

  static func parseDestination(from text: String) throws -> (
    path: String, template: [String: String]
  )? {
    let wrapped = text.hasPrefix("{") ? text : "{\(text)}"
    guard let object = try? parse(from: wrapped, context: "destination"),
      object.count == 1,
      let path = object.keys.first,
      let templateString = object[path],
      templateString.hasPrefix("{"),
      templateString.hasSuffix("}")
    else {
      return nil
    }

    let template = try parse(from: templateString, context: "destination template")
    return (path, template)
  }
}

@MainActor
enum EVYPlainTextResolution {
  static func resolveValues(
    _ data: [String: String],
    datum: EVYJson?,
    omitUnresolvedDatumKeys: Bool = false
  ) -> [String: EVYJson] {
    var resolved: [String: EVYJson] = [:]
    for (key, value) in data {
      if omitUnresolvedDatumKeys, shouldOmitUnresolvedDatumKey(value, datum: datum) {
        continue
      }
      resolved[key] = resolveValue(
        value, datum: datum, omitUnresolvedDatumKeys: omitUnresolvedDatumKeys)
    }
    return resolved
  }

  private static func shouldOmitUnresolvedDatumKey(_ value: String, datum: EVYJson?) -> Bool {
    guard let datumPath = datumPath(from: value) else { return false }
    guard let datum else { return true }
    let props = datumPath.split(separator: ".").map(String.init)
    return datum.parsePropStrict(props: props) == nil
  }

  static func resolveValue(
    _ value: String,
    datum: EVYJson?,
    omitUnresolvedDatumKeys: Bool = false
  ) -> EVYJson {
    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)

    if trimmedValue == EVY.datumToken, let datum {
      return datum
    }

    if let resolvedDatum = resolveDatumProperty(trimmedValue, datum: datum) {
      return resolvedDatum
    }

    if trimmedValue.hasPrefix("{"), trimmedValue.hasSuffix("}") {
      if let nestedObject = try? EVYObjectLiteral.parse(
        from: trimmedValue, context: "nested action data")
      {
        return .dictionary(
          resolveValues(
            nestedObject, datum: datum, omitUnresolvedDatumKeys: omitUnresolvedDatumKeys))
      }

      if let resolved = try? EVY.getDataFromText(trimmedValue) {
        return resolved
      }
      return .string(value)
    }

    if trimmedValue.contains("{"), trimmedValue.contains("}") {
      if let interpolated = try? EVY.getValueFromText(value) {
        return .string(interpolated.toString())
      }
    }

    if trimmedValue == "true" {
      return .bool(true)
    }
    if trimmedValue == "false" {
      return .bool(false)
    }
    if trimmedValue == "null" {
      return .null
    }
    if isBareNumericScalar(trimmedValue) {
      if let intValue = Int(trimmedValue) {
        return .int(intValue)
      }
      if let decimalValue = Decimal(string: trimmedValue) {
        return .decimal(decimalValue)
      }
    }
    // Whole-value "…" is a string literal (same delimiter as expression position),
    // not the old escape-to-force-literal rule for path-shaped bare words.
    if trimmedValue.count >= 2, trimmedValue.hasPrefix("\""), trimmedValue.hasSuffix("\"") {
      return .string(EVY.stripOptionalSurroundingQuotes(trimmedValue))
    }

    return .string(value)
  }

  private static func isBareNumericScalar(_ value: String) -> Bool {
    guard !value.isEmpty else { return false }
    var index = value.startIndex
    if value[index] == "-" {
      index = value.index(after: index)
      guard index < value.endIndex else { return false }
    }
    let digitsAndDot = value[index...]
    guard digitsAndDot.allSatisfy({ $0.isNumber || $0 == "." }) else { return false }
    return digitsAndDot.contains(where: \.isNumber)
  }

  private static func datumPath(from value: String) -> String? {
    var path = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if path.hasPrefix("{"), path.hasSuffix("}") {
      path = String(path.dropFirst().dropLast()).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    guard path.hasPrefix(EVY.datumPrefix) else { return nil }
    return String(path.dropFirst(EVY.datumPrefix.count))
  }

  private static func resolveDatumProperty(_ value: String, datum: EVYJson?) -> EVYJson? {
    var path = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if path.hasPrefix("{"), path.hasSuffix("}") {
      path = String(path.dropFirst().dropLast()).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    guard path.hasPrefix(EVY.datumPrefix), let datum else { return nil }
    let props = String(path.dropFirst(EVY.datumPrefix.count)).split(separator: ".").map(String.init)
    return datum.parsePropStrict(props: props)
  }
}
