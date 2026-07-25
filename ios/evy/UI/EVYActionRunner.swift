//
//  EVYActionRunner.swift
//  evy
//

import Foundation

@MainActor
enum EVYActionRunner {
  /// Runs actions in order; stops at the first branch that returns failure (`runBranch` == false).
  static func run(
    actions: [UI_RowAction],
    datum: EVYJson? = nil,
    show: @escaping (String) throws -> Void = { _ in },
    rowOperation: EVYRowOperationHandler? = nil,
    action: @escaping (ActionOperation) -> Void
  ) {
    guard !actions.isEmpty else { return }

    let resolvedRowOperation =
      rowOperation ?? { _ in
        throw EVYRowActionOperation.unsupportedError
      }

    for rowAction in actions {
      let condition = rowAction.condition.trimmingCharacters(in: .whitespacesAndNewlines)
      let executeTrueBranch: Bool

      if condition.isEmpty {
        executeTrueBranch = true
      } else {
        do {
          executeTrueBranch = try EVY.evaluateFromText(condition)
        } catch {
          // A condition that cannot be evaluated is an authoring error, not a
          // false result: surfacing it stops flows failing silently mid-sequence.
          NotificationCenter.default.post(
            name: .evyErrorOccurred,
            object: EVYError.invalidData(
              context: "could not evaluate condition \(condition): \(error.localizedDescription)")
          )
          return
        }
      }

      if !executeTrueBranch {
        runBranch(
          rowAction.`false`, datum: datum, show: show, rowOperation: resolvedRowOperation,
          action: action)
        return
      }

      let succeeded = runBranch(
        rowAction.`true`, datum: datum, show: show, rowOperation: resolvedRowOperation,
        action: action)
      if !succeeded {
        return
      }
    }
  }

  @discardableResult
  private static func runBranch(
    _ rawBranch: String,
    datum: EVYJson?,
    show: @escaping (String) throws -> Void,
    rowOperation: @escaping EVYRowOperationHandler,
    action: @escaping (ActionOperation) -> Void
  ) -> Bool {
    let trimmed = rawBranch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return true }
    do {
      try execute(
        branch: trimmed, datum: datum, action: action, show: show, rowOperation: rowOperation)
      return true
    } catch {
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
      return false
    }
  }

  private static func execute(
    branch: String,
    datum: EVYJson?,
    action: @escaping (ActionOperation) -> Void,
    show: @escaping (String) throws -> Void,
    rowOperation: @escaping EVYRowOperationHandler
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
            context:
              "create requires namespace, resource, and submit or data, e.g. create(marketplace,item,submit)"
          )
        }
        let resolvedData = try createAction.data.map {
          try resolveObjectArgument($0, datum: datum, stripIdFromChanges: false)
        }
        let createdId = try EVY.create(
          namespace: createAction.namespace,
          resource: createAction.resource,
          data: resolvedData,
          isSubmission: createAction.isSubmission
        )
        if let idDestination = createAction.idDestination {
          try EVY.writeRawStringValue(createdId, to: idDestination)
        }
      case "update":
        guard let updateAction = EVYActionParser.updateAction(from: branch) else {
          throw EVYError.invalidData(
            context:
              "update requires namespace, resource, filter, and changes, e.g. update(marketplace,messages,{id: abc},{archivedAt: now()})"
          )
        }
        let resolvedChanges = try resolveObjectArgument(
          updateAction.changes, datum: datum, stripIdFromChanges: true)
        switch updateAction.mode {
        case .store:
          let resolvedFilter = resolvePlainTextValues(updateAction.filter, datum: datum)
          try EVY.update(
            namespace: updateAction.namespace,
            resource: updateAction.resource,
            matching: resolvedFilter,
            changes: resolvedChanges
          )
        case .draft:
          try EVY.mergeIntoActiveDraft(
            resource: updateAction.resource,
            changes: resolvedChanges
          )
        }
      case "close":
        try requireNoArguments(functionArgs, function: "close")
        action(.close)
      case "show":
        guard let rowId = EVYActionParser.singleIdArgument(fromArgs: functionArgs) else {
          throw EVYError.invalidData(
            context: "show requires exactly one non-empty row id, e.g. show(row-id)")
        }
        try show(rowId)
      case "highlight_required":
        let args = EVY.splitFunctionArguments(functionArgs)
        let alias = args.first ?? "field"
        let lastSegment = alias.components(separatedBy: ".").last ?? alias
        let fieldName =
          lastSegment
          .replacingOccurrences(of: "_", with: " ")
          .trimmingCharacters(in: .whitespacesAndNewlines)
        let readableField = fieldName.isEmpty ? "Field" : fieldName.capitalized
        action(.highlightRequired(readableField))
      case "select":
        let args = EVY.splitFunctionArguments(functionArgs)
        guard args.count == 1 else {
          throw EVYError.invalidData(
            context: "select requires exactly one argument, e.g. select($datum)")
        }
        let resolved = resolvePlainTextValue(args[0], datum: datum)
        try rowOperation(.select(resolved))
      case "select_photo":
        try requireNoArguments(functionArgs, function: "select_photo")
        try rowOperation(.selectPhoto)
      case "expand_photo":
        try requireNoArguments(functionArgs, function: "expand_photo")
        try rowOperation(.expandPhoto)
      case "delete_photo":
        try requireNoArguments(functionArgs, function: "delete_photo")
        try rowOperation(.deletePhoto)
      case "expand_text":
        guard let rowId = EVYActionParser.singleIdArgument(fromArgs: functionArgs) else {
          throw EVYError.invalidData(
            context: "expand_text requires exactly one non-empty row id, e.g. expand_text(row-id)")
        }
        NotificationCenter.default.post(name: .evyExpandTextRow, object: rowId)
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

  private static func requireNoArguments(_ functionArgs: String, function: String) throws {
    guard functionArgs.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw EVYError.invalidData(context: "\(function) takes no arguments")
    }
  }

  private static func parseNavigateArguments(_ functionArgs: String) throws -> NavigateArguments {
    let args = EVY.splitFunctionArguments(functionArgs)
    guard args.count >= 2 else {
      throw EVYError.invalidData(context: "navigate requires flowId and pageId")
    }
    guard args.count <= 3 else {
      throw EVYError.invalidData(context: "navigate accepts at most 3 arguments")
    }
    return NavigateArguments(
      flowId: EVY.stripOptionalSurroundingQuotes(args[0]),
      pageId: EVY.stripOptionalSurroundingQuotes(args[1]),
      queryArgument: args.count > 2 ? args[2] : ""
    )
  }

  private static func resolvePlainTextValues(
    _ data: [String: String],
    datum: EVYJson?
  ) -> [String: EVYJson] {
    data.mapValues { resolvePlainTextValue($0, datum: datum) }
  }

  private static func resolveObjectArgument(
    _ argument: EVYObjectArgument,
    datum: EVYJson?,
    stripIdFromChanges: Bool
  ) throws -> [String: EVYJson] {
    switch argument {
    case .literal(let object):
      return resolvePlainTextValues(object, datum: datum)
    case .path(let path):
      let resolved = resolvePlainTextValue(path, datum: datum)
      guard case .dictionary(var dictionary) = resolved else {
        throw EVYError.invalidData(context: "data path must resolve to an object: \(path)")
      }
      if stripIdFromChanges {
        dictionary.removeValue(forKey: "id")
      }
      return dictionary
    }
  }

  private static func resolvePlainTextValue(
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
    // Quoted values are literal strings, never data paths
    if value.count >= 2, value.hasPrefix("\""), value.hasSuffix("\"") {
      return .string(EVY.stripOptionalSurroundingQuotes(value))
    }
    // Nested object literal, e.g. data: {type: pickup, time: selected_timeslot}
    if value.hasPrefix("{"), value.hasSuffix("}"),
      let nestedObject = try? EVYActionParser.plainTextObject(
        from: value, context: "nested action data")
    {
      return .dictionary(resolvePlainTextValues(nestedObject, datum: datum))
    }

    return (try? EVY.getDataFromText("{\(value)}")) ?? .string(value)
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

      return EVY.splitFunctionArguments(innerValue)
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
    }

    return [value]
  }
}
