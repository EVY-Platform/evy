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
/// values, e.g. the nested object in `data: {type: pickup, time: selected}`.
///
/// This is all that remains of parsing action text at runtime. Actions
/// themselves are stored structured, so nothing else reads the old call syntax.
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
    // Plain paths (e.g. item.title) are not object literals — parse throws on missing
    // key:value pairs. Treat that as "not a template destination", not a write failure.
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
    datum: EVYJson?
  ) -> [String: EVYJson] {
    data.mapValues { resolveValue($0, datum: datum) }
  }

  static func resolveValue(
    _ value: String,
    datum: EVYJson?
  ) -> EVYJson {
    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmedValue == EVY.datumToken, let datum {
      return datum
    }
    if trimmedValue.hasPrefix(EVY.datumPrefix), let datum {
      let props = String(trimmedValue.dropFirst(EVY.datumPrefix.count)).split(separator: ".").map(
        String.init)
      if let resolvedValue = datum.parsePropStrict(props: props) {
        return resolvedValue
      }
    }

    if value == "true" {
      return .bool(true)
    }
    if value == "false" {
      return .bool(false)
    }
    if value == "null" {
      return .null
    }
    if value.count >= 2, value.hasPrefix("\""), value.hasSuffix("\"") {
      return .string(EVY.stripOptionalSurroundingQuotes(value))
    }
    if value.hasPrefix("{"), value.hasSuffix("}"),
      let nestedObject = try? EVYObjectLiteral.parse(
        from: value, context: "nested action data")
    {
      return .dictionary(resolveValues(nestedObject, datum: datum))
    }

    return (try? EVY.getDataFromText("{\(value)}")) ?? .string(value)
  }
}
