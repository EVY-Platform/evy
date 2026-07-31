//
//  EVYActionParser.swift
//  evy
//

import Foundation

enum EVYActionParseError: Error, Equatable {
  case reason(String)

  var localizedDescription: String {
    switch self {
    case .reason(let message): return message
    }
  }
}

enum EVYActionParser {
  private static let zeroArgFunctions: Set<String> = [
    "close", "select_photo", "expand_photo", "delete_photo",
  ]
  private static let rowTargetFunctions: Set<String> = ["show", "expand_text"]

  static func parse(_ branch: String) throws -> EVYActionInvocation {
    let trimmed = branch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw EVYActionParseError.reason("empty branch")
    }

    guard let call = parseFunctionCall(trimmed) else {
      throw EVYActionParseError.reason("not a brace-wrapped function call")
    }

    let args = call.args.isEmpty ? [] : EVY.splitFunctionArguments(call.args)

    if zeroArgFunctions.contains(call.name) {
      guard args.isEmpty else {
        throw EVYActionParseError.reason("\(call.name) takes no arguments")
      }
      return zeroArgInvocation(call.name)
    }

    if rowTargetFunctions.contains(call.name) {
      guard args.count == 1 else {
        throw EVYActionParseError.reason("\(call.name) takes exactly one row id")
      }
      let rowId = EVY.stripOptionalSurroundingQuotes(args[0])
        .trimmingCharacters(in: .whitespacesAndNewlines)
      guard !rowId.isEmpty else {
        throw EVYActionParseError.reason("\(call.name) row id must not be empty")
      }
      return rowTargetInvocation(call.name, rowId: rowId)
    }

    switch call.name {
    case "highlight_required":
      guard args.count == 1 else {
        throw EVYActionParseError.reason("highlight_required takes one field")
      }
      let field = args[0].trimmingCharacters(in: .whitespacesAndNewlines)
      guard !field.isEmpty else {
        throw EVYActionParseError.reason("highlight_required field must not be empty")
      }
      return .highlightRequired(field: field)

    case "select":
      guard args.count == 1 else {
        throw EVYActionParseError.reason("select takes one value")
      }
      let value = args[0].trimmingCharacters(in: .whitespacesAndNewlines)
      guard !value.isEmpty else {
        throw EVYActionParseError.reason("select value must not be empty")
      }
      return .select(value: value)

    case "navigate":
      return try convertNavigate(args)

    case "create":
      return try convertCreate(args)

    case "update":
      return try convertUpdate(args)

    default:
      throw EVYActionParseError.reason("unknown action function `\(call.name)`")
    }
  }

  static func serialize(_ invocation: EVYActionInvocation) -> String {
    switch invocation {
    case .close: return "{close()}"
    case .selectPhoto: return "{select_photo()}"
    case .expandPhoto: return "{expand_photo()}"
    case .deletePhoto: return "{delete_photo()}"
    case .show(let rowId): return call("show", [rowId])
    case .expandText(let rowId): return call("expand_text", [rowId])
    case .highlightRequired(let field): return call("highlight_required", [field])
    case .select(let value): return call("select", [value])
    case .navigate(let flowId, let pageId, let query):
      var args = [flowId, pageId]
      if !query.isEmpty {
        args.append(serializeExpressionMap(query))
      }
      return call("navigate", args)
    case .create(let resource, let mode, let id_destination):
      switch mode {
      case .submit:
        return call("create", [resource, "submit"])
      case .inline(let data):
        var args = [resource, serializeExpressionMap(data)]
        if let id_destination { args.append(id_destination) }
        return call("create", args)
      case .fromPath(let data_path):
        var args = [resource, data_path]
        if let id_destination { args.append(id_destination) }
        return call("create", args)
      }
    case .update(let resource, let mode, let filter, let changes):
      let filterArg = mode == .store ? serializeExpressionMap(filter) : "{}"
      let changesArg: String
      switch changes {
      case .literal(let map): changesArg = serializeExpressionMap(map)
      case .path(let path): changesArg = path
      }
      var args = [resource, filterArg, changesArg]
      if mode == .draft { args.append("draft") }
      return call("update", args)
    }
  }

  static func conformanceAst(from invocation: EVYActionInvocation) -> EVYJson {
    switch invocation {
    case .close:
      return .dictionary(["fn": .string("close")])
    case .selectPhoto:
      return .dictionary(["fn": .string("select_photo")])
    case .expandPhoto:
      return .dictionary(["fn": .string("expand_photo")])
    case .deletePhoto:
      return .dictionary(["fn": .string("delete_photo")])
    case .show(let rowId):
      return .dictionary(["fn": .string("show"), "row_id": .string(rowId)])
    case .expandText(let rowId):
      return .dictionary(["fn": .string("expand_text"), "row_id": .string(rowId)])
    case .highlightRequired(let field):
      return .dictionary(["fn": .string("highlight_required"), "field": .string(field)])
    case .select(let value):
      return .dictionary(["fn": .string("select"), "value": .string(value)])
    case .navigate(let flowId, let pageId, let query):
      var dict: [String: EVYJson] = [
        "fn": .string("navigate"),
        "flow_id": .string(flowId),
        "page_id": .string(pageId),
      ]
      if !query.isEmpty {
        dict["query"] = .dictionary(query.mapValues { .string($0) })
      }
      return .dictionary(dict)
    case .create(let resource, let mode, let id_destination):
      var dict: [String: EVYJson] = [
        "fn": .string("create"),
        "resource": .string(resource),
      ]
      switch mode {
      case .submit:
        dict["mode"] = .string("submit")
      case .inline(let data):
        dict["mode"] = .string("inline")
        dict["data"] = .dictionary(data.mapValues { .string($0) })
      case .fromPath(let data_path):
        dict["mode"] = .string("from_path")
        dict["data_path"] = .string(data_path)
      }
      if let id_destination {
        dict["id_destination"] = .string(id_destination)
      }
      return .dictionary(dict)
    case .update(let resource, let mode, let filter, let changes):
      var dict: [String: EVYJson] = [
        "fn": .string("update"),
        "resource": .string(resource),
        "mode": .string(mode.rawValue),
      ]
      if mode == .store {
        dict["filter"] = .dictionary(filter.mapValues { .string($0) })
      }
      switch changes {
      case .literal(let map):
        dict["changes"] = .dictionary(map.mapValues { .string($0) })
      case .path(let path):
        dict["changes_path"] = .string(path)
      }
      return .dictionary(dict)
    }
  }

  private static func call(_ name: String, _ args: [String]) -> String {
    "{\(name)(\(args.joined(separator: ",")))}"
  }

  private static func serializeExpressionMap(_ map: [String: String]) -> String {
    let pairs = map.map { "\($0.key): \($0.value)" }
    return "{\(pairs.joined(separator: ", "))}"
  }

  private static func parseFunctionCall(_ rawBranch: String) -> (name: String, args: String)? {
    var branch = rawBranch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return nil }
    branch = String(branch.dropFirst().dropLast()).trimmingCharacters(in: .whitespacesAndNewlines)

    guard let parenIndex = branch.firstIndex(of: "("),
      branch.hasSuffix(")")
    else { return nil }

    let name = String(branch[..<parenIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
    guard name.first?.isLetter == true || name.first == "_" else { return nil }
    guard name.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }) else { return nil }

    let argsStart = branch.index(after: parenIndex)
    let argsEnd = branch.index(before: branch.endIndex)
    let args = String(branch[argsStart..<argsEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
    return (name, args)
  }

  private static func parsePlainTextObject(
    _ text: String,
    allowEmptyValues: Bool = false
  ) -> [String: String]? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("{"), trimmed.hasSuffix("}") else { return nil }

    let inner = String(trimmed.dropFirst().dropLast())
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !inner.isEmpty else { return [:] }

    var object: [String: String] = [:]
    for pair in EVY.splitFunctionArguments(inner) {
      guard let colonIndex = pair.firstIndex(of: ":") else { return nil }
      let key = pair[..<colonIndex].trimmingCharacters(in: .whitespacesAndNewlines)
      let value = pair[pair.index(after: colonIndex)...]
        .trimmingCharacters(in: .whitespacesAndNewlines)
      guard !key.isEmpty, allowEmptyValues || !value.isEmpty else { return nil }
      object[key] = EVY.stripOptionalSurroundingQuotes(value)
    }
    return object
  }

  private enum ParsedObjectArgument {
    case map([String: String])
    case path(String)
  }

  private static func parseObjectArgument(_ text: String) -> ParsedObjectArgument? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasPrefix("{"), trimmed.hasSuffix("}") {
      guard let map = parsePlainTextObject(trimmed) else { return nil }
      return .map(map)
    }
    guard !trimmed.isEmpty else { return nil }
    return .path(trimmed)
  }

  private static func convertCreate(_ args: [String]) throws -> EVYActionInvocation {
    guard args.count >= 2 else {
      throw EVYActionParseError.reason("create requires resource and data")
    }
    let resource = args[0].trimmingCharacters(in: .whitespacesAndNewlines)
    guard EVYResourceRef.isValid(resource) else {
      throw EVYActionParseError.reason("create requires a service-prefixed resource ref")
    }

    let second = args[1].trimmingCharacters(in: .whitespacesAndNewlines)
    if second == "submit" {
      guard args.count == 2 else {
        throw EVYActionParseError.reason("create submit takes no further arguments")
      }
      return .create(resource: resource, mode: .submit, id_destination: nil)
    }

    guard let data = parseObjectArgument(args[1]) else {
      throw EVYActionParseError.reason("create data is neither an object nor a path")
    }

    var idDestination: String?
    if args.count > 2 {
      idDestination = args[2].trimmingCharacters(in: .whitespacesAndNewlines)
      guard let idDestination, !idDestination.isEmpty else {
        throw EVYActionParseError.reason("create id destination must not be empty")
      }
    }
    guard args.count <= 3 else {
      throw EVYActionParseError.reason("create accepts at most 3 arguments")
    }

    switch data {
    case .map(let map):
      return .create(resource: resource, mode: .inline(data: map), id_destination: idDestination)
    case .path(let path):
      return .create(
        resource: resource, mode: .fromPath(data_path: path), id_destination: idDestination)
    }
  }

  private static func convertUpdate(_ args: [String]) throws -> EVYActionInvocation {
    guard args.count >= 3, args.count <= 4 else {
      throw EVYActionParseError.reason("update takes 3 or 4 arguments")
    }
    let resource = args[0].trimmingCharacters(in: .whitespacesAndNewlines)
    guard EVYResourceRef.isValid(resource) else {
      throw EVYActionParseError.reason("update requires a service-prefixed resource ref")
    }

    let isDraft = args.count == 4
    if isDraft {
      let modeArg = args[3].trimmingCharacters(in: .whitespacesAndNewlines)
      guard modeArg == "draft" else {
        throw EVYActionParseError.reason("update mode argument must be `draft`")
      }
    }

    guard let filter = parsePlainTextObject(args[1]) else {
      throw EVYActionParseError.reason("update filter must be an object")
    }
    if isDraft, !filter.isEmpty {
      throw EVYActionParseError.reason("a draft update must not carry a filter")
    }
    if !isDraft, filter.isEmpty {
      throw EVYActionParseError.reason("a store update requires a non-empty filter")
    }

    guard let changes = parseObjectArgument(args[2]) else {
      throw EVYActionParseError.reason("update changes are neither an object nor a path")
    }
    if case .map(let map) = changes, map.isEmpty {
      throw EVYActionParseError.reason("update changes must not be empty")
    }

    let mode: EVYActionInvocation.UpdateMode = isDraft ? .draft : .store
    let changesArg: EVYObjectArgument
    switch changes {
    case .map(let map): changesArg = .literal(map)
    case .path(let path): changesArg = .path(path)
    }
    return .update(resource: resource, mode: mode, filter: filter, changes: changesArg)
  }

  private static func convertNavigate(_ args: [String]) throws -> EVYActionInvocation {
    guard args.count >= 2 else {
      throw EVYActionParseError.reason("navigate requires flowId and pageId")
    }
    guard args.count <= 3 else {
      throw EVYActionParseError.reason("navigate accepts at most 3 arguments")
    }

    let flowId = EVY.stripOptionalSurroundingQuotes(args[0])
    let pageId = EVY.stripOptionalSurroundingQuotes(args[1])
    guard !flowId.isEmpty, !pageId.isEmpty else {
      throw EVYActionParseError.reason("navigate requires flowId and pageId")
    }

    let rawQuery =
      args.count > 2
      ? args[2].trimmingCharacters(in: .whitespacesAndNewlines) : ""
    if rawQuery.isEmpty {
      return .navigate(flowId: flowId, pageId: pageId, query: [:])
    }

    guard let query = parsePlainTextObject(rawQuery, allowEmptyValues: true) else {
      throw EVYActionParseError.reason("navigate query must be an object")
    }
    return .navigate(flowId: flowId, pageId: pageId, query: query)
  }

  private static func zeroArgInvocation(_ name: String) -> EVYActionInvocation {
    switch name {
    case "close": return .close
    case "select_photo": return .selectPhoto
    case "expand_photo": return .expandPhoto
    case "delete_photo": return .deletePhoto
    default: fatalError("unexpected zero-arg function \(name)")
    }
  }

  private static func rowTargetInvocation(_ name: String, rowId: String) -> EVYActionInvocation {
    switch name {
    case "show": return .show(rowId: rowId)
    case "expand_text": return .expandText(rowId: rowId)
    default: fatalError("unexpected row-target function \(name)")
    }
  }
}
