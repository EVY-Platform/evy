//
//  EVYActionParser.swift
//  evy
//

import Foundation

enum EVYObjectArgument: Equatable {
  case literal([String: String])
  case path(String)
}

struct EVYCreateAction: Equatable {
  let namespace: String
  let resource: String
  let data: EVYObjectArgument?
  let idDestination: String?
}

struct EVYUpdateAction: Equatable {
  let namespace: String
  let resource: String
  let filter: [String: String]
  let changes: EVYObjectArgument
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

    let data: EVYObjectArgument?
    if args.count > 2 {
      guard let parsedData = try? objectArgument(from: args[2], context: "create data") else {
        return nil
      }
      data = parsedData
    } else {
      data = nil
    }

    let idDestination: String?
    if args.count > 3 {
      let destination = args[3].trimmingCharacters(in: .whitespacesAndNewlines)
      guard !destination.isEmpty else { return nil }
      idDestination = destination
    } else {
      idDestination = nil
    }

    return EVYCreateAction(
      namespace: namespace, resource: resource, data: data, idDestination: idDestination)
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
    guard let changes = try? objectArgument(from: args[3], context: "update changes") else {
      return nil
    }
    if case .literal(let literalChanges) = changes, literalChanges.isEmpty {
      return nil
    }

    return EVYUpdateAction(
      namespace: namespace, resource: resource, filter: filter, changes: changes)
  }

  static func objectArgument(from text: String, context: String) throws -> EVYObjectArgument {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasPrefix("{"), trimmed.hasSuffix("}") {
      return .literal(try plainTextObject(from: trimmed, context: context))
    }
    guard !trimmed.isEmpty else {
      throw EVYError.invalidData(context: "\(context) path must not be empty")
    }
    return .path(trimmed)
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

  /// Parses already-split function args for a single non-empty id (e.g. args of `show(rowId)`).
  static func singleIdArgument(fromArgs functionArgs: String) -> String? {
    let args = EVY.splitFunctionArguments(functionArgs)
    guard args.count == 1 else { return nil }
    let rowId = EVY.stripOptionalSurroundingQuotes(args[0])
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !rowId.isEmpty else { return nil }
    return rowId
  }
}
