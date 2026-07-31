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
  nonisolated static func parseKeyValuePairs(
    inner: String,
    stripQuotes: Bool,
    allowEmptyValues: Bool
  ) -> [String: String]? {
    let trimmedInner = inner.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedInner.isEmpty else { return [:] }

    var object: [String: String] = [:]
    for pair in EVY.splitFunctionArguments(trimmedInner) {
      guard let colonIndex = pair.firstIndex(of: ":") else { return nil }

      let key = pair[..<colonIndex].trimmingCharacters(in: .whitespacesAndNewlines)
      let value = pair[pair.index(after: colonIndex)...]
        .trimmingCharacters(in: .whitespacesAndNewlines)
      guard !key.isEmpty, allowEmptyValues || !value.isEmpty else { return nil }
      object[key] = stripQuotes ? EVY.stripOptionalSurroundingQuotes(value) : value
    }

    return object
  }

  static func parse(from text: String, context: String) throws -> [String: String] {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("{"), trimmed.hasSuffix("}") else {
      throw EVYError.invalidData(context: "\(context) must be wrapped in {}")
    }

    let inner = String(trimmed.dropFirst().dropLast())
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard
      let object = parseKeyValuePairs(
        inner: inner, stripQuotes: false, allowEmptyValues: false
      )
    else {
      throw EVYError.invalidData(context: "\(context) must be key:value pairs")
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
  private enum DatumResolution {
    case notADatumPath
    case unresolved
    case resolved(EVYJson)
  }

  static func resolveValues(
    _ data: [String: String],
    datum: EVYJson?,
    omitUnresolvedDatumKeys: Bool = false
  ) -> [String: EVYJson] {
    var resolved: [String: EVYJson] = [:]
    for (key, value) in data {
      let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
      switch resolveDatum(trimmed, datum: datum) {
      case .notADatumPath:
        resolved[key] = resolveValue(
          value, datum: datum, omitUnresolvedDatumKeys: omitUnresolvedDatumKeys)
      case .unresolved:
        if !omitUnresolvedDatumKeys {
          resolved[key] = resolveValue(
            value, datum: datum, omitUnresolvedDatumKeys: omitUnresolvedDatumKeys)
        }
      case .resolved(let json):
        resolved[key] = json
      }
    }
    return resolved
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

    switch resolveDatum(trimmedValue, datum: datum) {
    case .resolved(let json):
      return json
    case .notADatumPath, .unresolved:
      break
    }

    if trimmedValue.hasPrefix("{"), trimmedValue.hasSuffix("}") {
      if let nestedObject = try? EVYObjectLiteral.parse(
        from: trimmedValue, context: "nested action data")
      {
        return .dictionary(
          resolveValues(
            nestedObject, datum: datum, omitUnresolvedDatumKeys: omitUnresolvedDatumKeys))
      }

      let inner = String(trimmedValue.dropFirst().dropLast())
        .trimmingCharacters(in: .whitespacesAndNewlines)
      if let resolved = resolveBoundExpression(inner, datum: datum) {
        return resolved
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

    if let resolved = resolveBoundExpression(trimmedValue, datum: datum) {
      return resolved
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

  private static func resolveDatum(_ trimmedValue: String, datum: EVYJson?) -> DatumResolution {
    let normalized = EVY.unwrapOptionalBraces(trimmedValue)
    guard let path = datumPath(from: normalized) else { return .notADatumPath }
    guard let datum else { return .unresolved }
    let props = path.split(separator: ".").map(String.init)
    guard let value = datum.parsePropStrict(props: props) else { return .unresolved }
    return .resolved(value)
  }

  private static func datumPath(from normalized: String) -> String? {
    guard normalized.hasPrefix(EVY.datumPrefix) else { return nil }
    return String(normalized.dropFirst(EVY.datumPrefix.count))
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

  /// A value expression may nest `$datum` inside a function call, e.g.
  /// `findFirst(marketplace.items, $datum.fk).title`. Whole-`$datum` values are handled
  /// above; this binds the datum for everything else, at execution time — the row formatter
  /// deliberately leaves `actions` unsubstituted for exactly this reason.
  private static func resolveBoundExpression(_ value: String, datum: EVYJson?) -> EVYJson? {
    guard shouldBindDatumForExpression(value) else { return nil }
    guard let datum, EVY.containsDatumReference(value) else {
      return try? EVY.getDataFromText("{\(value)}")
    }
    return try? evyEvaluate(value, boundTo: datum) { substituted in
      try EVY.getDataFromText("{\(substituted)}")
    }
  }

  private static func shouldBindDatumForExpression(_ value: String) -> Bool {
    let normalized = EVY.unwrapOptionalBraces(
      value.trimmingCharacters(in: .whitespacesAndNewlines))
    if normalized == EVY.datumToken || normalized.hasPrefix(EVY.datumPrefix) {
      return false
    }
    return EVY.containsDatumReference(value) || value.contains("(")
  }
}
