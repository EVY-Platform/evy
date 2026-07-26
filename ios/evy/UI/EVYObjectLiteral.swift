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
}
