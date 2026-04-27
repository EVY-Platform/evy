//
//  interpreter.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

private let comparisonBlockPattern = "\\{[^{}\"]+\\}"
private let comparisonOperators = [">=", "<=", "==", "!=", ">", "<"]
private let propsPattern = "\\{(?!\")[^}^\"]*(?!\")\\}"
private let functionParamsPattern = "\\(([^)]*)\\)"
private let functionPattern = "[a-zA-Z_]+\(functionParamsPattern)"
private let arrayPattern = "\\[([\\d]*)\\]"
public let PROP_SEPARATOR = "."

// MARK: - Public API

@MainActor
public func parsePropsFromText(_ input: String) -> String {
  _parsePropsFromText(input)
}

@MainActor
public func splitPropsFromText(_ props: String) throws -> [String] {
  if props.count < 1 {
    throw EVYParamError.invalidProps
  }

  var splitProps = props.components(separatedBy: PROP_SEPARATOR)
  if splitProps.count < 1 {
    throw EVYParamError.invalidProps
  }
  for i in splitProps.indices {
    if let matchArray = try? firstMatch(
      splitProps[i],
      pattern: arrayPattern)
    {
      splitProps[i].removeSubrange(matchArray.range)

      let matchIndex = String(matchArray.0.dropFirst().dropLast())
      splitProps.insert(matchIndex, at: i + 1)
    }
  }
  return splitProps
}

@MainActor
func parseTextFromText(
  _ input: String,
  _ editing: Bool = false
) throws -> EVYValue {
  try parseText(EVYValue(input, nil, nil), editing)
}

@MainActor
public func parseFunctionCall(_ input: String) -> (functionName: String, functionArgs: String)? {
  let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
  if let (_, functionName, functionArgs) = parseFunctionInText(trimmedInput) {
    return (functionName, functionArgs)
  }
  return nil
}

@MainActor
func splitFunctionArguments(_ args: String) -> [String] {
  var components: [String] = []
  var current = ""
  var depth = 0
  var inString = false

  for ch in args {
    if inString {
      current.append(ch)
      if ch == "\"" {
        inString = false
      }
      continue
    }

    switch ch {
    case "\"":
      inString = true
      current.append(ch)
    case "(":
      depth += 1
      current.append(ch)
    case ")":
      depth -= 1
      current.append(ch)
    case "," where depth == 0:
      let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
      if !trimmed.isEmpty {
        components.append(trimmed)
      }
      current = ""
    default:
      current.append(ch)
    }
  }

  let trimmedTail = current.trimmingCharacters(in: .whitespacesAndNewlines)
  if !trimmedTail.isEmpty {
    components.append(trimmedTail)
  }
  return components
}

@MainActor
public func stripOptionalSurroundingQuotes(_ s: String) -> String {
  let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
  guard trimmed.count >= 2, trimmed.first == "\"", trimmed.last == "\"" else {
    return trimmed
  }
  return String(trimmed.dropFirst().dropLast())
}

@MainActor
public func getDataFromText(_ input: String) throws -> EVYJson {
  try _getDataFromText(input)
}

@MainActor
public func getDataFromProps(_ props: String) throws -> EVYJson {
  try _getDataFromProps(props)
}

@MainActor
func getValueFromText(_ input: String, editing: Bool = false) throws -> EVYValue {
  try _getValueFromText(input, editing: editing)
}

@MainActor
public func watchTarget(for text: String) -> String {
  _watchTarget(for: text)
}

@MainActor
public func evaluateFromText(_ input: String) throws -> Bool {
  try _evaluateFromText(input)
}

@MainActor
public func formatData(json: EVYJson, format: String) throws -> String {
  try _formatData(json: json, format: format)
}

// MARK: - Internal

@MainActor
func _parsePropsFromText(_ input: String) -> String {
  guard let match = try? firstMatch(input, pattern: propsPattern) else {
    return input
  }

  return String(match.0.dropFirst().dropLast())
}

@MainActor
func _getDataFromText(_ input: String) throws -> EVYJson {
  let props = _parsePropsFromText(input)
  return try _getDataFromProps(props)
}

@MainActor
func _getDataFromProps(_ props: String) throws -> EVYJson {
  let splitProps = try splitPropsFromText(props)
  guard let firstProp = splitProps.first else {
    throw EVYParamError.invalidProps
  }

  if let scopeId = EVY.data.activeDraftScopeId,
    let draftBinding = try? EVY.data.draftBinding(fromParsedProps: props, scopeId: scopeId),
    let draftRow = EVY.data.draftIfPresent(binding: draftBinding)
  {
    let remaining = EVYDraft.remainingPropsAfterDraftPrefix(
      splitProps: splitProps,
      binding: draftBinding
    )
    return try draftRow.decoded().parseProp(props: remaining)
  }

  let remainingProps = splitProps.count > 1 ? Array(splitProps[1...]) : []
  let dataObj = try EVY.data.getForBinding(key: firstProp)
  return try dataObj.decoded().parseProp(props: remainingProps)
}

@MainActor
func _getValueFromText(_ input: String, editing: Bool = false) throws -> EVYValue {
  let match = try parseTextFromText(input, editing)
  return EVYValue(match.value, match.prefix, match.suffix)
}

@MainActor
func _watchTarget(for text: String) -> String {
  let unwrapped = _parsePropsFromText(text)
  let candidates: [String] = unwrapped == text ? [text] : [unwrapped, text]
  for candidate in candidates {
    if let functionCall = parseFunctionCall(candidate) {
      let parts = splitFunctionArguments(functionCall.functionArgs)
      if let first = parts.first, !first.isEmpty {
        return stripOptionalSurroundingQuotes(first)
      }
      return functionCall.functionArgs
    }
  }
  if unwrapped != text {
    return unwrapped
  }
  return text
}

@MainActor
func _evaluateFromText(_ input: String) throws -> Bool {
  let match = try parseTextFromText(input)
  return match.value == "true"
}

@MainActor
func _formatData(json: EVYJson, format: String) throws -> String {
  if format.count < 1 { return "" }

  let temporaryId = UUID().uuidString
  let formatWithNewData =
    format
    .replacingOccurrences(of: "$datum:", with: "\(temporaryId).")

  if formatWithNewData.isEmpty { return "" }

  let encodedData = try JSONEncoder().encode(json)
  try EVY.data.create(key: temporaryId, data: encodedData)
  let returnText = try _getValueFromText(formatWithNewData)
  try EVY.data.delete(key: temporaryId)
  return returnText.toString()
}

// MARK: - Private parsing

@MainActor
private func parseText(
  _ input: EVYValue,
  _ editing: Bool
) throws -> EVYValue {
  if input.value.isEmpty {
    return input
  }

  if let (fullMatch, comparison) = parseComparisonFromText(input.value) {
    let comparisonResult = try evaluateBooleanExpression(comparison) { operand in
      let trimmedOperand = operand.trimmingCharacters(in: .whitespacesAndNewlines)
      let parsedOperand = try parseText(
        EVYValue(trimmedOperand, nil, nil),
        editing)
      if parsedOperand.value != trimmedOperand {
        return parsedOperand.value
      }
      if let propsValue = try? _getDataFromText("{\(trimmedOperand)}") {
        return propsValue.toString()
      }
      return parsedOperand.value
    }
    let parsedInput = input.value.replacingOccurrences(
      of: fullMatch,
      with: comparisonResult ? "true" : "false"
    )
    return try parseText(
      EVYValue(parsedInput, input.prefix, input.suffix),
      editing)
  }

  if let (match, funcName, funcArgs) =
    parseFunctionFromText(input.value)
    ?? parseFunctionInText(input.value)
  {
    let returnPrefix = match.startIndex == 0
    let upperBound = match.range.upperBound.utf16Offset(in: input.value)
    let returnSuffix = upperBound == input.value.count

    let value: EVYFunctionOutput?

    switch funcName {
    case "count":
      value = try evyCount(funcArgs)
    case "length":
      value = try evyLength(funcArgs)
    case "formatCurrency":
      value = try evyFormatCurrency(funcArgs, editing)
    case "formatDimension":
      value = try evyFormatDimension(funcArgs, editing)
    case "formatWeight":
      value = try evyFormatWeight(funcArgs, editing)
    case "formatAddress":
      value = try evyFormatAddress(funcArgs)
    case "formatDecimal":
      value = try evyFormatDecimal(funcArgs, editing)
    case "formatMetricLength":
      value = try evyFormatMetricLength(funcArgs, editing)
    case "formatImperialLength":
      value = try evyFormatImperialLength(funcArgs, editing)
    case "formatDuration":
      value = try evyFormatDuration(funcArgs, editing)
    case "formatDate":
      value = try evyFormatDate(funcArgs, editing)
    case "buildCurrency", "buildAddress":
      value = nil
    default:
      value = nil
    }

    if let value = value {
      let returnValuesToJoin = [
        returnPrefix ? "" : value.prefix ?? "",
        value.value,
        returnSuffix ? "" : value.suffix ?? "",
      ]
      let parsedInput = input.value.replacingOccurrences(
        of: match.0.description,
        with: returnValuesToJoin.joined()
      )
      return try parseText(
        EVYValue(
          parsedInput,
          returnPrefix ? value.prefix : input.prefix,
          returnSuffix ? value.suffix : input.suffix),
        editing)
    }
  }

  if let (match, props) = parseProps(input.value) {
    let data = try _getDataFromProps(props)
    let parsedInput = input.value.replacingOccurrences(
      of: match.0.description,
      with: data.toString())
    return try parseText(
      EVYValue(parsedInput, input.prefix, input.suffix),
      editing)
  }

  return input
}

private func parseProps(_ input: String) -> (Regex<AnyRegexOutput>.Match, String)? {
  if let match = try? firstMatch(input, pattern: propsPattern) {
    return (match, String(match.0.dropFirst().dropLast()))
  }
  return nil
}

private func parseComparisonFromText(_ input: String) -> (fullMatch: String, content: String)? {
  guard let regex = try? Regex(comparisonBlockPattern) else {
    return nil
  }
  for match in input.matches(of: regex) {
    let block = String(match.0)
    let comparison = String(block.dropFirst().dropLast())
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if containsTopLevelComparisonOperator(comparison) {
      return (block, comparison)
    }
  }
  return nil
}

private func evaluateBooleanExpression(
  _ input: String,
  resolver: (String) throws -> String
) throws -> Bool {
  let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
  let orTerms = splitRespectingParens(trimmedInput, separator: "||")
  if orTerms.count > 1 {
    for term in orTerms {
      if try evaluateBooleanExpression(term, resolver: resolver) {
        return true
      }
    }
    return false
  }

  let andTerms = splitRespectingParens(trimmedInput, separator: "&&")
  if andTerms.count > 1 {
    for term in andTerms {
      if try !evaluateBooleanExpression(term, resolver: resolver) {
        return false
      }
    }
    return true
  }

  if isWrappedInParentheses(trimmedInput) {
    let innerExpression = String(trimmedInput.dropFirst().dropLast())
    return try evaluateBooleanExpression(innerExpression, resolver: resolver)
  }

  if trimmedInput == "true" {
    return true
  }
  if trimmedInput == "false" {
    return false
  }

  guard let (left, comparisonOperator, right) = parseAtomicComparison(trimmedInput) else {
    throw EVYError.invalidData(context: "Invalid comparison expression: \(trimmedInput)")
  }

  let resolvedLeft = try resolver(left)
  let resolvedRight = try resolver(right)
  return evyComparison(comparisonOperator, left: resolvedLeft, right: resolvedRight)
}

private func splitRespectingParens(_ input: String, separator: String) -> [String] {
  guard !input.isEmpty else {
    return [input]
  }

  var parts: [String] = []
  var depth = 0
  var currentStart = input.startIndex
  var index = input.startIndex

  while index < input.endIndex {
    let character = input[index]
    if character == "(" {
      depth += 1
    } else if character == ")" && depth > 0 {
      depth -= 1
    }

    if depth == 0, input[index...].hasPrefix(separator) {
      parts.append(
        String(input[currentStart..<index])
          .trimmingCharacters(in: .whitespacesAndNewlines))
      currentStart = input.index(index, offsetBy: separator.count)
      index = currentStart
      continue
    }

    index = input.index(after: index)
  }

  parts.append(String(input[currentStart...]).trimmingCharacters(in: .whitespacesAndNewlines))
  return parts
}

private func firstTopLevelComparison(in input: String) -> (opIndex: String.Index, op: String)? {
  var depth = 0
  var index = input.startIndex

  while index < input.endIndex {
    let character = input[index]
    if character == "(" {
      depth += 1
    } else if character == ")" && depth > 0 {
      depth -= 1
    }

    if depth == 0 {
      for comparisonOperator in comparisonOperators {
        if input[index...].hasPrefix(comparisonOperator) {
          return (index, comparisonOperator)
        }
      }
    }

    index = input.index(after: index)
  }

  return nil
}

private func parseAtomicComparison(_ input: String) -> (
  left: String,
  comparisonOperator: String,
  right: String
)? {
  guard let (opIndex, comparisonOperator) = firstTopLevelComparison(in: input) else {
    return nil
  }
  let left = String(input[..<opIndex]).trimmingCharacters(in: .whitespacesAndNewlines)
  let rightStart = input.index(opIndex, offsetBy: comparisonOperator.count)
  let right = String(input[rightStart...]).trimmingCharacters(in: .whitespacesAndNewlines)
  guard !left.isEmpty, !right.isEmpty else {
    return nil
  }
  return (left, comparisonOperator, right)
}

private func containsTopLevelComparisonOperator(_ input: String) -> Bool {
  firstTopLevelComparison(in: input) != nil
}

private func isWrappedInParentheses(_ input: String) -> Bool {
  guard input.first == "(", input.last == ")" else {
    return false
  }

  var depth = 0
  for index in input.indices {
    let character = input[index]
    if character == "(" {
      depth += 1
    } else if character == ")" {
      depth -= 1
      if depth == 0 {
        return index == input.index(before: input.endIndex)
      }
    }
  }

  return false
}

private func parseFunctionFromText(_ input: String) -> (
  match: Regex<AnyRegexOutput>.Match,
  functionName: String,
  functionArgs: String
)? {
  guard let match = try? firstMatch(input, pattern: "\\{\(functionPattern)\\}") else {
    return nil
  }

  guard let (_, functionName, functionArgs) = parseFunctionInText(input) else {
    return nil
  }

  return (match, functionName, functionArgs)
}

private func parseFunctionInText(_ input: String) -> (
  match: Regex<AnyRegexOutput>.Match,
  functionName: String,
  functionArgs: String
)? {
  guard let match = try? firstMatch(input, pattern: functionPattern) else {
    return nil
  }

  // Remove opening { from match
  let functionCall = match.0.description
  guard
    let argsAndParenthesisMatch = try? firstMatch(
      functionCall,
      pattern: functionParamsPattern)
  else {
    return nil
  }

  let parenthesisStartIndex = argsAndParenthesisMatch.range.lowerBound
  let functionNameEndIndex = functionCall.index(before: parenthesisStartIndex)
  let functionName = functionCall[functionCall.startIndex...functionNameEndIndex]

  let argsAndParenthesis = argsAndParenthesisMatch.0.description
  let functionArgs = argsAndParenthesis.dropFirst().dropLast()

  return (match, String(functionName), String(functionArgs))
}

private var regexPatternCache: [String: Regex<AnyRegexOutput>] = [:]

private func regexForPattern(_ pattern: String) throws -> Regex<AnyRegexOutput> {
  if let cached = regexPatternCache[pattern] {
    return cached
  }
  let r = try Regex(pattern)
  regexPatternCache[pattern] = r
  return r
}

private func firstMatch(_ input: String, pattern: String) throws -> Regex<AnyRegexOutput>.Match? {
  let regex = try regexForPattern(pattern)
  return input.firstMatch(of: regex)
}

private func lastMatch(_ input: String, pattern: String) throws -> Regex<AnyRegexOutput>.Match? {
  let regex = try regexForPattern(pattern)
  return input.matches(of: regex).last
}

#Preview {
  AsyncPreview { asyncView in
    asyncView
  } view: {
    try! EVY.getUserData()
    try! await EVY.createItem()

    let bare = "test"
    let data = "{item.title}"

    let parsedData = try! parseTextFromText(data)
    let withPrefix = try! parseTextFromText(
      "{formatCurrency(item.price)}"
    )
    let withSuffix = try! parseTextFromText(
      "{formatDimension(item.dimensions.width)}"
    )
    let WithSuffixAndRight = try! parseTextFromText(
      "{formatDimension(item.dimensions.width)} - {item.title}"
    )
    let withComparison = try! parseTextFromText(
      "{count(item.title) == count(selling_reasons)} v {count(item.title) == count(item.title)}"
    )
    let withMultiComparison = try! parseTextFromText(
      "{count(item.title) > 0 || (1 > 2 && count(selling_reasons) > 0)}"
    )

    let weight = try! parseTextFromText(
      "{formatWeight(item.dimensions.weight)}"
    )

    let firstSellingReason = try! EVY.getDataFromText("{selling_reasons[0]}")

    return VStack {
      Text("parseProps but no props: " + parsePropsFromText(bare))
      Text("parseProps with props: " + parsePropsFromText(data))
      Text(parsedData.toString())
      Text(withPrefix.toString())
      Text(withSuffix.toString())
      Text(WithSuffixAndRight.toString())
      Text(withComparison.toString())
      Text(withMultiComparison.toString())
      Text(weight.toString())
      Text(firstSellingReason.toString())

      EVYTextField(
        input: "{formatCurrency(item.price)}",
        destination: "{item.price}",
        placeholder: "Editing price")
    }
  }
}
