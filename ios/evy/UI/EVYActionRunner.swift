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
    let unwrappedBranch = unwrapActionBranch(branch)

    guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return }

    if let (functionName, functionArgs) = parseFunctionCall(unwrappedBranch) {
      switch functionName {
      case "navigate":
        let args = splitFunctionArguments(functionArgs)
        guard args.count >= 2 else {
          throw EVYError.invalidData(context: "navigate requires flowId and pageId")
        }
        let flowId = stripOptionalSurroundingQuotes(args[0])
        let pageId = stripOptionalSurroundingQuotes(args[1])

        let queryArgument = args.count > 2 ? args.dropFirst(2).joined(separator: ",") : ""
        let query = try parseQueryArgument(queryArgument)
        let resolvedQuery = resolveDatumInQuery(query, datum: datum)
        navigate(
          .navigate(Route(flowId: flowId, pageId: pageId, query: resolvedQuery))
        )
      case "create":
        let args = splitFunctionArguments(functionArgs)
        guard let key = args.first, !key.isEmpty else {
          throw EVYError.invalidData(context: "create requires a key")
        }
        navigate(.create(key))
      case "close":
        navigate(.close)
      case "show":
        if let child = row?.view.content.child {
          show(child)
        }
      case "highlight_required":
        let args = splitFunctionArguments(functionArgs)
        let alias = args.first ?? "field"
        let fieldName =
          alias
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

  private static func parseQueryArgument(_ value: String) throws -> [String: [String]] {
    let trimmedValue = stripOptionalSurroundingQuotes(value)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedValue.isEmpty else { return [:] }
    guard trimmedValue.hasPrefix("{") else {
      throw EVYError.invalidData(context: "navigate query params must be a JSON object")
    }
    return parseJsonQuery(trimmedValue)
  }

  private static func parseJsonQuery(_ jsonString: String) -> [String: [String]] {
    let normalizedJsonString = quoteUnquotedDatumExpressions(in: jsonString)
    guard let data = normalizedJsonString.data(using: .utf8),
      let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return [:]
    }

    var query: [String: [String]] = [:]
    for (key, value) in parsed {
      guard !key.isEmpty else { continue }
      if let array = value as? [Any] {
        let strings = array.compactMap { element -> String? in
          if let s = element as? String, !s.isEmpty { return s }
          return nil
        }
        if !strings.isEmpty {
          query[key] = strings
        }
      } else if let s = value as? String, !s.isEmpty {
        query[key] = [s]
      }
    }
    return query
  }

  private static func quoteUnquotedDatumExpressions(in jsonString: String) -> String {
    let pattern = #"(?<!\")\$datum\.[A-Za-z0-9_.-]+"#
    guard let regex = try? NSRegularExpression(pattern: pattern) else {
      return jsonString
    }

    var normalizedJsonString = jsonString
    let range = NSRange(normalizedJsonString.startIndex..., in: normalizedJsonString)
    let matches = regex.matches(in: normalizedJsonString, range: range)
    for match in matches.reversed() {
      guard let matchRange = Range(match.range, in: normalizedJsonString) else {
        continue
      }
      let token = String(normalizedJsonString[matchRange])
      normalizedJsonString.replaceSubrange(matchRange, with: "\"\(token)\"")
    }
    return normalizedJsonString
  }

  private static func resolveDatumInQuery(
    _ query: [String: [String]], datum: EVYJson?
  ) -> [String: [String]] {
    EVY.resolveDatumInQuery(query, datum: datum)
  }

  private static func unwrapActionBranch(_ branch: String) -> String {
    guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return branch }
    return String(branch.dropFirst().dropLast())
  }
}
