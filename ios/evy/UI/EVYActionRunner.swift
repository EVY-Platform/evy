//
//  EVYActionRunner.swift
//  evy
//

import Foundation

@MainActor
enum EVYActionRunner {
  static func run(
    actions: [UI_RowAction],
    datum: EVYJson? = nil,
    childRef: EVYRowRef? = nil,
    show: @escaping (EVYRowRef) -> Void = { _ in },
    prepare: (() -> Void)? = nil,
    action: @escaping (ActionOperation) -> Void
  ) {
    guard !actions.isEmpty else { return }

    prepare?()

    for rowAction in actions {
      let condition = rowAction.condition.trimmingCharacters(in: .whitespacesAndNewlines)
      let executeTrueBranch: Bool

      if condition.isEmpty {
        executeTrueBranch = true
      } else {
        executeTrueBranch = (try? EVY.evaluateFromText(condition)) ?? false
      }

      if !executeTrueBranch {
        runBranch(rowAction.`false`, datum: datum, childRef: childRef, show: show, action: action)
        return
      }

      let succeeded = runBranch(
        rowAction.`true`, datum: datum, childRef: childRef, show: show, action: action)
      if !succeeded {
        return
      }
    }
  }

  @discardableResult
  private static func runBranch(
    _ rawBranch: String,
    datum: EVYJson?,
    childRef: EVYRowRef?,
    show: @escaping (EVYRowRef) -> Void,
    action: @escaping (ActionOperation) -> Void
  ) -> Bool {
    let trimmed = rawBranch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return true }
    do {
      try execute(
        branch: trimmed, datum: datum, childRef: childRef, action: action, show: show)
      return true
    } catch {
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
      return false
    }
  }

  private static func execute(
    branch: String,
    datum: EVYJson?,
    childRef: EVYRowRef?,
    action: @escaping (ActionOperation) -> Void,
    show: @escaping (EVYRowRef) -> Void
  ) throws {
    guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return }

    if let (functionName, functionArgs) = EVYActionParser.functionCall(from: branch) {
      switch functionName {
      case "navigate":
        let navArgs = try parseNavigateArguments(functionArgs)
        let query = try parseQueryArgument(navArgs.queryArgument)
        let resolvedQuery = EVY.resolveDatumInQuery(query, datum: datum)
        action(
          .navigate(
            Route(
              flowId: navArgs.flowId,
              pageId: navArgs.pageId,
              query: resolvedQuery
            ))
        )
      case "create":
        guard let createAction = EVYActionParser.createAction(from: branch) else {
          throw EVYError.invalidData(
            context: "create requires namespace and resource, e.g. create(marketplace,item)")
        }
        let resolvedData = createAction.data.map { resolvePlainTextValues($0, datum: datum) }
        try EVY.create(
          namespace: createAction.namespace,
          resource: createAction.resource,
          data: resolvedData
        )
      case "update":
        guard let updateAction = EVYActionParser.updateAction(from: branch) else {
          throw EVYError.invalidData(
            context:
              "update requires namespace, resource, filter, and changes, e.g. update(marketplace,requests,{id: abc},{archived: true})"
          )
        }
        let resolvedFilter = resolvePlainTextValues(updateAction.filter, datum: datum)
        let resolvedChanges = resolvePlainTextValues(updateAction.changes, datum: datum)
        try EVY.update(
          namespace: updateAction.namespace,
          resource: updateAction.resource,
          matching: resolvedFilter,
          changes: resolvedChanges
        )
      case "close":
        action(.close)
      case "show":
        guard let childRef else {
          throw EVYError.invalidData(
            context: "show() requires the row to have a child to present")
        }
        show(childRef)
      case "highlight_required":
        let args = splitFunctionArguments(functionArgs)
        let alias = args.first ?? "field"
        let lastSegment = alias.components(separatedBy: ".").last ?? alias
        let fieldName =
          lastSegment
          .replacingOccurrences(of: "_", with: " ")
          .trimmingCharacters(in: .whitespacesAndNewlines)
        let readableField = fieldName.isEmpty ? "Field" : fieldName.capitalized
        action(.highlightRequired(readableField))
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

  private static func resolvePlainTextValues(
    _ data: [String: String],
    datum: EVYJson?
  ) -> [String: EVYJson] {
    var resolvedData: [String: EVYJson] = [:]

    for (key, value) in data {
      if value.hasPrefix(EVY.datumPrefix), let datum {
        let props = String(value.dropFirst(EVY.datumPrefix.count)).split(separator: ".").map(
          String.init)
        if let resolvedValue = datum.parsePropStrict(props: props) {
          resolvedData[key] = resolvedValue
          continue
        }
      }

      if value == "true" {
        resolvedData[key] = .bool(true)
        continue
      }
      if value == "false" {
        resolvedData[key] = .bool(false)
        continue
      }

      resolvedData[key] = (try? EVY.getDataFromText("{\(value)}")) ?? .string(value)
    }

    return resolvedData
  }

  private static func parseQueryArgument(_ value: String) throws -> [String: [String]] {
    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedValue.isEmpty else { return [:] }

    let queryValues = try EVYActionParser.plainTextObject(
      from: trimmedValue,
      context: "navigate query params",
      allowsEmptyValues: true
    )
    var query: [String: [String]] = [:]
    for (key, value) in queryValues {
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
