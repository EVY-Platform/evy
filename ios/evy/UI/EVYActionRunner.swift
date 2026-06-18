//
//  EVYActionRunner.swift
//  evy
//

import Foundation

@MainActor
enum EVYActionRunner {
  static func run(
    actions: [UI_RowAction],
    row: UI_Row? = nil,
    datum: EVYJson? = nil,
    show: @escaping (UI_Row) -> Void = { _ in },
    navigate: @escaping (NavOperation) -> Void
  ) {
    guard !actions.isEmpty else { return }

    for action in actions {
      let condition = action.condition.trimmingCharacters(in: .whitespacesAndNewlines)
      let executeTrueBranch: Bool

      if condition.isEmpty {
        executeTrueBranch = true
      } else {
        executeTrueBranch = (try? EVY.evaluateFromText(condition)) ?? false
      }

      if !executeTrueBranch {
        runBranch(action.`false`, row: row, datum: datum, show: show, navigate: navigate)
        return
      }

      runBranch(action.`true`, row: row, datum: datum, show: show, navigate: navigate)
    }
  }

  private static func runBranch(
    _ rawBranch: String,
    row: UI_Row?,
    datum: EVYJson?,
    show: @escaping (UI_Row) -> Void,
    navigate: @escaping (NavOperation) -> Void
  ) {
    let trimmed = rawBranch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    do {
      try execute(branch: trimmed, row: row, datum: datum, navigate: navigate, show: show)
    } catch {
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
    }
  }

  private static func execute(
    branch: String,
    row: UI_Row?,
    datum: EVYJson?,
    navigate: @escaping (NavOperation) -> Void,
    show: @escaping (UI_Row) -> Void
  ) throws {
    guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return }
    let unwrappedBranch = String(branch.dropFirst().dropLast())

    if let (functionName, functionArgs) = parseFunctionCall(unwrappedBranch) {
      switch functionName {
      case "navigate":
        let navArgs = try parseNavigateArguments(functionArgs)
        let query = try parseQueryArgument(navArgs.queryArgument)
        let resolvedQuery = EVY.resolveDatumInQuery(query, datum: datum)
        navigate(
          .navigate(
            Route(
              flowId: navArgs.flowId,
              pageId: navArgs.pageId,
              query: resolvedQuery
            ))
        )
      case "create":
        let args = splitFunctionArguments(functionArgs)
        guard args.count >= 2,
          let namespace = args.first, !namespace.isEmpty,
          let resource = args.dropFirst().first, !resource.isEmpty
        else {
          throw EVYError.invalidData(
            context: "create requires namespace and resource, e.g. create(marketplace,item)")
        }
        navigate(.create(namespace: namespace, resource: resource))
      case "close":
        navigate(.close)
      case "show":
        if let child = row?.view.content.child {
          show(child)
        }
      case "highlight_required":
        let args = splitFunctionArguments(functionArgs)
        let alias = args.first ?? "field"
        let lastSegment = alias.components(separatedBy: ".").last ?? alias
        let fieldName =
          lastSegment
          .replacingOccurrences(of: "_", with: " ")
          .trimmingCharacters(in: .whitespacesAndNewlines)
        let readableField = fieldName.isEmpty ? "Field" : fieldName.capitalized
        navigate(.highlightRequired(readableField))
      default:
        throw EVYError.invalidData(context: "Unsupported action function: \(functionName)")
      }
    } else {
      return
    }
  }

  private struct NavigateArguments {
    let flowId: String
    let pageId: String
    let queryArgument: String
  }

  private static func parseNavigateArguments(_ functionArgs: String) throws -> NavigateArguments {
    let args = splitFunctionArguments(functionArgs)
    guard args.count >= 2 else {
      throw EVYError.invalidData(context: "navigate requires flowId and pageId")
    }
    guard args.count <= 3 else {
      throw EVYError.invalidData(context: "navigate accepts at most 3 arguments")
    }
    return NavigateArguments(
      flowId: stripOptionalSurroundingQuotes(args[0]),
      pageId: stripOptionalSurroundingQuotes(args[1]),
      queryArgument: args.count > 2 ? args[2] : ""
    )
  }

  private static func parseQueryArgument(_ value: String) throws -> [String: [String]] {
    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedValue.isEmpty else { return [:] }
    return try parsePlainTextQuery(trimmedValue)
  }

  private static func parsePlainTextQuery(_ text: String) throws -> [String: [String]] {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("{"), trimmed.hasSuffix("}") else {
      throw EVYError.invalidData(context: "navigate query params must be wrapped in {}")
    }

    let inner = String(trimmed.dropFirst().dropLast())
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !inner.isEmpty else { return [:] }

    var query: [String: [String]] = [:]
    for pair in splitFunctionArguments(inner) {
      guard let colonIndex = pair.firstIndex(of: ":") else {
        throw EVYError.invalidData(context: "navigate query params must be key:value pairs")
      }

      let key = pair[..<colonIndex]
        .trimmingCharacters(in: .whitespacesAndNewlines)
      guard !key.isEmpty else { continue }

      let value = pair[pair.index(after: colonIndex)...]
        .trimmingCharacters(in: .whitespacesAndNewlines)
      let values = try parsePlainTextQueryValue(value)
      if !values.isEmpty {
        query[key] = values
      }
    }

    return query
  }

  private static func parsePlainTextQueryValue(_ value: String) throws -> [String] {
    guard !value.isEmpty else { return [] }

    if value.hasPrefix("[") || value.hasSuffix("]") {
      guard value.hasPrefix("["), value.hasSuffix("]") else {
        throw EVYError.invalidData(context: "navigate query arrays must be wrapped in []")
      }

      let innerValue = String(value.dropFirst().dropLast())
        .trimmingCharacters(in: .whitespacesAndNewlines)
      guard !innerValue.isEmpty else { return [] }

      return splitFunctionArguments(innerValue)
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
    }

    return [value]
  }

}
