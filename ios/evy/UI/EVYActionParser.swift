//
//  EVYActionParser.swift
//  evy
//

import Foundation

struct EVYCreateAction: Equatable {
  let namespace: String
  let resource: String
  let data: [String: String]?
}

struct EVYUpdateAction: Equatable {
  let namespace: String
  let resource: String
  let filter: [String: String]
  let changes: [String: String]
}

@MainActor
enum EVYActionParser {
  static func createAction(from rawBranch: String) -> EVYCreateAction? {
    guard let parsed = functionCall(from: rawBranch), parsed.name == "create" else {
      return nil
    }
    let args = EVY.splitFunctionArguments(parsed.args)
    guard args.count >= 2 else { return nil }
    let namespace = args[0].trimmingCharacters(in: .whitespacesAndNewlines)
    let resource = args[1].trimmingCharacters(in: .whitespacesAndNewlines)
    guard !namespace.isEmpty, !resource.isEmpty else { return nil }

    let data: [String: String]?
    if args.count > 2 {
      data = try? plainTextObject(from: args[2], context: "create data")
      guard data != nil else { return nil }
    } else {
      data = nil
    }

    return EVYCreateAction(namespace: namespace, resource: resource, data: data)
  }

  static func updateAction(from rawBranch: String) -> EVYUpdateAction? {
    guard let parsed = functionCall(from: rawBranch), parsed.name == "update" else {
      return nil
    }
    let args = EVY.splitFunctionArguments(parsed.args)
    guard args.count >= 4 else { return nil }
    let namespace = args[0].trimmingCharacters(in: .whitespacesAndNewlines)
    let resource = args[1].trimmingCharacters(in: .whitespacesAndNewlines)
    guard !namespace.isEmpty, !resource.isEmpty else { return nil }

    guard let filter = try? plainTextObject(from: args[2], context: "update filter"),
      !filter.isEmpty
    else { return nil }
    guard let changes = try? plainTextObject(from: args[3], context: "update changes"),
      !changes.isEmpty
    else { return nil }

    return EVYUpdateAction(
      namespace: namespace, resource: resource, filter: filter, changes: changes)
  }

  static func plainTextObject(
    from text: String,
    context: String,
    allowsEmptyValues: Bool = false
  ) throws -> [String: String] {
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
      guard !key.isEmpty, allowsEmptyValues || !value.isEmpty else {
        throw EVYError.invalidData(context: "\(context) must be key:value pairs")
      }
      object[key] = value
    }

    return object
  }

  static func functionCall(from rawBranch: String) -> (name: String, args: String)? {
    var branch = rawBranch.trimmingCharacters(in: .whitespacesAndNewlines)
    if branch.hasPrefix("{"), branch.hasSuffix("}") {
      branch = String(branch.dropFirst().dropLast())
    }
    guard let (name, args) = EVY.parseFunctionCall(branch) else { return nil }
    return (name, args)
  }

  /// Parses `{show(rowId)}` and returns the target row id when the branch is valid.
  static func showRowId(from rawBranch: String) -> String? {
    guard let parsed = functionCall(from: rawBranch), parsed.name == "show" else {
      return nil
    }
    let args = EVY.splitFunctionArguments(parsed.args)
    guard args.count == 1 else { return nil }
    let rowId = EVY.stripOptionalSurroundingQuotes(args[0])
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !rowId.isEmpty else { return nil }
    return rowId
  }
}
