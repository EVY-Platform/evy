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
        let falseBranch = action.`false`.trimmingCharacters(in: .whitespacesAndNewlines)
        if !falseBranch.isEmpty {
          do {
            try execute(branch: falseBranch, datum: datum, navigate: navigate)
          } catch {
            NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
          }
        }
        return
      }

      let trueBranch = action.`true`.trimmingCharacters(in: .whitespacesAndNewlines)
      if trueBranch.isEmpty { continue }

      do {
        try execute(branch: trueBranch, datum: datum, navigate: navigate)
      } catch {
        NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
      }
    }
  }

  private static func execute(
    branch: String,
    datum: EVYJson?,
    navigate: @escaping (NavOperation) -> Void
  ) throws {
    let unwrappedBranch = unwrapActionBranch(branch)

    if let operation = parseColonFormat(unwrappedBranch, datum: datum)
      ?? parseColonFormat(branch, datum: datum)
    {
      navigate(operation)
      return
    }

    guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return }

    if let (functionName, functionArgs) = parseFunctionCall(unwrappedBranch) {
      switch functionName {
      case "navigate":
        let args = splitFunctionArguments(functionArgs)
        guard args.count >= 2 else {
          throw EVYError.invalidData(context: "navigate requires flowId and pageId")
        }
        let flowId = stripOptionalSurroundingQuotes(args[0])
        let pageArgument = stripOptionalSurroundingQuotes(args[1])
        let extraQueryArgument = args.count > 2 ? args.dropFirst(2).joined(separator: ",") : ""
        let querySeparator: String
        if extraQueryArgument.isEmpty {
          querySeparator = ""
        } else if pageArgument.contains("?") {
          querySeparator = ","
        } else {
          querySeparator = "?"
        }
        let pageRoute = splitPageAndQuery(pageArgument + querySeparator + extraQueryArgument)
        let resolvedQuery = resolveDatumInQuery(pageRoute.query, datum: datum)
        navigate(
          .navigate(Route(flowId: flowId, pageId: pageRoute.pageId, query: resolvedQuery))
        )
      case "create":
        let args = splitFunctionArguments(functionArgs)
        guard let key = args.first, !key.isEmpty else {
          throw EVYError.invalidData(context: "create requires a key")
        }
        navigate(.create(key))
      case "close":
        navigate(.close)
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

  private static func parseColonFormat(_ value: String, datum: EVYJson?) -> NavOperation? {
    let parts = value.split(separator: ":", maxSplits: 2)
    guard let keyword = parts.first else { return nil }
    switch keyword {
    case "navigate":
      guard parts.count == 3 else { return nil }
      let pageRoute = splitPageAndQuery(String(parts[2]))
      let resolvedQuery = resolveDatumInQuery(pageRoute.query, datum: datum)
      return .navigate(
        Route(
          flowId: String(parts[1]),
          pageId: pageRoute.pageId,
          query: resolvedQuery
        )
      )
    case "create":
      guard parts.count == 2 else { return nil }
      return .create(String(parts[1]))

    default:
      return nil
    }
  }

  private static func splitPageAndQuery(_ value: String) -> (
    pageId: String, query: [String: [String]]
  ) {
    let parts = value.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
    let pageId = String(parts.first ?? "")
    guard parts.count == 2 else {
      return (pageId, [:])
    }
    return (pageId, parseQueryString(String(parts[1])))
  }

  private static func parseQueryString(_ value: String) -> [String: [String]] {
    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedValue.isEmpty else { return [:] }

    if trimmedValue.hasPrefix("{") {
      return parseJsonQuery(trimmedValue)
    }

    var query: [String: [String]] = [:]
    let pairs = trimmedValue.split(separator: "&", omittingEmptySubsequences: true)
    for pair in pairs {
      let keyValue = pair.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
      guard keyValue.count == 2 else { continue }

      let key = decodeQueryComponent(String(keyValue[0]))
      guard !key.isEmpty else { continue }

      let value = decodeQueryComponent(String(keyValue[1]))
      guard !value.isEmpty else { continue }

      query[key, default: []].append(value)
    }

    return query
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
    guard let datum else { return query }

    var resolved: [String: [String]] = [:]
    for (key, values) in query {
      resolved[key] = values.map { resolveDatumExpression($0, datum: datum) }
    }
    return resolved
  }

  private static func resolveDatumExpression(_ value: String, datum: EVYJson) -> String {
    guard value.hasPrefix("$datum.") else { return value }
    let fieldPath = String(value.dropFirst("$datum.".count))
    guard !fieldPath.isEmpty else { return value }
    let props = fieldPath.split(separator: ".").map(String.init)
    let resolved = datum.parseProp(props: props)
    let result = resolved.identifierValue()
    return result.isEmpty ? value : result
  }

  private static func decodeQueryComponent(_ value: String) -> String {
    value.replacingOccurrences(of: "+", with: " ").removingPercentEncoding ?? value
  }

  private static func unwrapActionBranch(_ branch: String) -> String {
    guard branch.hasPrefix("{"), branch.hasSuffix("}") else { return branch }
    return String(branch.dropFirst().dropLast())
  }
}
