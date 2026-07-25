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
    _ branch: EVYActionBranch,
    datum: EVYJson?,
    show: @escaping (String) throws -> Void,
    rowOperation: @escaping EVYRowOperationHandler,
    action: @escaping (ActionOperation) -> Void
  ) -> Bool {
    guard case .invocation(let invocation) = branch else { return true }
    do {
      try run(
        invocation: invocation, datum: datum, action: action, show: show,
        rowOperation: rowOperation)
      return true
    } catch {
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
      return false
    }
  }

  private static func run(
    invocation: EVYActionInvocation,
    datum: EVYJson?,
    action: @escaping (ActionOperation) -> Void,
    show: @escaping (String) throws -> Void,
    rowOperation: @escaping EVYRowOperationHandler
  ) throws {
    switch invocation {
    case .close:
      action(.close)

    case .selectPhoto:
      try rowOperation(.selectPhoto)

    case .expandPhoto:
      try rowOperation(.expandPhoto)

    case .deletePhoto:
      try rowOperation(.deletePhoto)

    case .show(let rowId):
      try show(rowId)

    case .expandText(let rowId):
      NotificationCenter.default.post(name: .evyExpandTextRow, object: rowId)

    case .highlightRequired(let field):
      action(.highlightRequired(readableFieldName(from: field)))

    case .select(let value):
      try rowOperation(.select(resolvePlainTextValue(value, datum: datum)))

    case .navigate(let flowId, let pageId, let query):
      let expanded = try expandQueryValues(query)
      action(
        .navigate(
          Route(
            flowId: flowId,
            pageId: pageId,
            query: EVY.resolveDatumInQuery(expanded, datum: datum)
          ))
      )

    case .create(let service, let resource, let mode, let idDestination):
      let data: EVYObjectArgument?
      let isSubmission: Bool
      switch mode {
      case .submit:
        data = nil
        isSubmission = true
      case .inline(let map):
        data = .literal(map)
        isSubmission = false
      case .fromPath(let path):
        data = .path(path)
        isSubmission = false
      }
      let resolvedData = try data.map {
        try resolveObjectArgument($0, datum: datum, stripIdFromChanges: false)
      }
      let createdId = try EVY.create(
        namespace: service,
        resource: resource,
        data: resolvedData,
        isSubmission: isSubmission
      )
      if let idDestination {
        try EVY.writeRawStringValue(createdId, to: idDestination)
      }

    case .update(let service, let resource, let mode, let filter, let changes):
      let resolvedChanges = try resolveObjectArgument(
        changes, datum: datum, stripIdFromChanges: true)
      switch mode {
      case .store:
        try EVY.update(
          namespace: service,
          resource: resource,
          matching: resolvePlainTextValues(filter, datum: datum),
          changes: resolvedChanges
        )
      case .draft:
        try EVY.mergeIntoActiveDraft(resource: resource, changes: resolvedChanges)
      }
    }
  }

  /// `title` / `item.pickup_time` -> "Title" / "Pickup time".
  private static func readableFieldName(from alias: String) -> String {
    let lastSegment = alias.components(separatedBy: ".").last ?? alias
    let fieldName =
      lastSegment
      .replacingOccurrences(of: "_", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return fieldName.isEmpty ? "Field" : fieldName.capitalized
  }

  /// Navigate query values may be single values or `[a, b]` lists. Empty values
  /// are dropped, matching how the legacy query argument was parsed.
  private static func expandQueryValues(_ query: [String: String]) throws -> [String: [String]] {
    var expanded: [String: [String]] = [:]
    for (key, value) in query {
      let values = try parsePlainTextQueryValue(value)
      if !values.isEmpty {
        expanded[key] = values
      }
    }
    return expanded
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
      let nestedObject = try? EVYObjectLiteral.parse(
        from: value, context: "nested action data")
    {
      return .dictionary(resolvePlainTextValues(nestedObject, datum: datum))
    }

    return (try? EVY.getDataFromText("{\(value)}")) ?? .string(value)
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
