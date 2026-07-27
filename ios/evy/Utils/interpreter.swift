//
//  interpreter.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import Foundation

private let comparisonOperators = [">=", "<=", "==", "!=", ">", "<"]
// Matches a props object literal with no quoted values. e.g. {archivedAt: now()}, {name: test}
private let propsPattern = "\\{(?!\")[^}^\"]*(?!\")\\}"
// Matches a parenthesized arg list allowing one level of nested calls,
// e.g. update(..., {archivedAt: now()}) — matches (a, b), (x, foo(y))
private let functionParamsPattern = "\\((?:[^()]|\\([^()]*\\))*\\)"
// Matches a function call: identifier followed by its params. e.g. now(), update(id, {archivedAt: now()})
private let functionPattern = "[a-zA-Z_][a-zA-Z0-9_]*\(functionParamsPattern)"
// Matches a numeric array index accessor. e.g. [0], [123]
private let arrayPattern = "\\[([\\d]*)\\]"
let PROP_SEPARATOR = "."

// Ephemeral datum registry for in-memory formatting.
// Temporary datums used by _formatData are stored here instead of SwiftData
// to avoid expensive create/delete operations and notification storms.
@MainActor
private var ephemeralDatumRegistry: [String: EVYJson] = [:]

@MainActor
func evyWithEphemeralDatum<T>(
  key: String,
  value: EVYJson,
  _ body: () throws -> T
) rethrows -> T {
  ephemeralDatumRegistry[key] = value
  defer {
    ephemeralDatumRegistry.removeValue(forKey: key)
  }
  return try body()
}

@MainActor
func splitPropsFromText(_ props: String) throws -> [String] {
  if props.count < 1 {
    throw EVYParamError.invalidProps
  }

  var splitProps = splitTopLevel(props, separator: PROP_SEPARATOR, includingEmptyValues: false)
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
  _ editing: Bool = false,
  scope: EVYScope? = nil
) throws -> EVYValue {
  try parseText(EVYValue(input, nil, nil), editing, scope)
}

@MainActor
func _parseFunctionCall(_ input: String) -> (functionName: String, functionArgs: String)? {
  let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
  if let (_, functionName, functionArgs) = parseFunctionInText(trimmedInput) {
    return (functionName, functionArgs)
  }
  return nil
}

@MainActor
func _splitFunctionArguments(_ args: String) -> [String] {
  splitTopLevel(args, separator: ",")
}

@MainActor
func _stripOptionalSurroundingQuotes(_ s: String) -> String {
  let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
  guard trimmed.count >= 2, trimmed.first == "\"", trimmed.last == "\"" else {
    return trimmed
  }
  return String(trimmed.dropFirst().dropLast())
}

private enum TopLevelIndexMode {
  case first
  case last
}

private struct ParserScanState {
  var parenDepth = 0
  var bracketDepth = 0
  var braceDepth = 0
  var quote: Character?
  var previousCharacter: Character = "\0"

  var isInString: Bool {
    quote != nil
  }

  var isTopLevel: Bool {
    parenDepth == 0 && bracketDepth == 0 && braceDepth == 0
  }

  mutating func scan(_ character: Character) {
    if let quote {
      if character == quote && previousCharacter != "\\" {
        self.quote = nil
      }
      previousCharacter = character
      return
    }

    if character == "\"" || character == "'" {
      quote = character
    } else {
      switch character {
      case "(":
        parenDepth += 1
      case ")":
        parenDepth -= 1
      case "[":
        bracketDepth += 1
      case "]":
        bracketDepth -= 1
      case "{":
        braceDepth += 1
      case "}":
        braceDepth -= 1
      default:
        break
      }
    }

    previousCharacter = character
  }
}

@MainActor
private func topLevelIndex(
  of targetCharacter: Character,
  in input: String,
  mode: TopLevelIndexMode = .first
) -> String.Index? {
  var state = ParserScanState()
  var foundIndex: String.Index?

  for index in input.indices {
    let character = input[index]
    if !state.isInString && character == targetCharacter && state.isTopLevel {
      if mode == .first {
        return index
      }
      foundIndex = index
    }
    state.scan(character)
  }

  return state.isTopLevel ? foundIndex : nil
}

private func splitTopLevel(_ input: String, separator: Character) -> [String] {
  splitTopLevel(input, separator: String(separator), includingEmptyValues: false)
}

private func splitTopLevel(
  _ input: String,
  separator: String,
  includingEmptyValues: Bool
) -> [String] {
  guard !input.isEmpty else {
    return includingEmptyValues ? [input] : []
  }

  var components: [String] = []
  var state = ParserScanState()
  var currentStart = input.startIndex
  var index = input.startIndex

  while index < input.endIndex {
    if !state.isInString && state.isTopLevel && input[index...].hasPrefix(separator) {
      appendTopLevelComponent(
        String(input[currentStart..<index]),
        to: &components,
        includingEmptyValues: includingEmptyValues
      )
      currentStart = input.index(index, offsetBy: separator.count)
      index = currentStart
      continue
    }

    state.scan(input[index])
    index = input.index(after: index)
  }

  appendTopLevelComponent(
    String(input[currentStart...]),
    to: &components,
    includingEmptyValues: includingEmptyValues
  )
  return components
}

private func appendTopLevelComponent(
  _ value: String,
  to components: inout [String],
  includingEmptyValues: Bool
) {
  let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
  if includingEmptyValues || !trimmedValue.isEmpty {
    components.append(trimmedValue)
  }
}

private func findFirstTopLevelPrefix(
  in input: String,
  prefixes: [String]
) -> (opIndex: String.Index, op: String)? {
  var state = ParserScanState()
  var index = input.startIndex

  while index < input.endIndex {
    if !state.isInString && state.isTopLevel {
      for prefix in prefixes where input[index...].hasPrefix(prefix) {
        return (index, prefix)
      }
    }

    state.scan(input[index])
    index = input.index(after: index)
  }

  return nil
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
func _getDataFromText(_ input: String, scope: EVYScope? = nil) throws -> EVYJson {
  let props = _parsePropsFromText(input)
  return try _getDataFromProps(props, scope: scope)
}

@MainActor
private func _resolveBindingRoot(
  _ props: String,
  scope explicitScope: EVYScope? = nil
) throws -> (
  root: EVYJson, remainingProps: [String]
) {
  // nil means "whatever the globals say", which is how every call site behaved
  // before scope became a value. Default parameters cannot read main-actor
  // state, so the fallback is resolved here instead.
  let scope = explicitScope ?? .ambient
  let (store, cleanProps) = EVY.store(for: props)
  let splitProps = try splitPropsFromText(cleanProps)
  guard let firstProp = splitProps.first else {
    throw EVYParamError.invalidProps
  }

  let remainingProps = splitProps.count > 1 ? Array(splitProps[1...]) : []

  if let (funcName, funcArgs) = _parseFunctionCall(firstProp) {
    if funcName == "findFirst" {
      return (try evyFindFirst(funcArgs, remainingProps: remainingProps), [])
    }
    if funcName == "sort" {
      return (try evySort(funcArgs), remainingProps)
    }
    if funcName == "now" {
      return (.string(EVY.nowISO8601()), [])
    }
  }

  if let ephemeralDatum = ephemeralDatumRegistry[firstProp] {
    return (ephemeralDatum, remainingProps)
  }

  // 1. Check draft store — user's unsaved edits (exact path, then parent prefixes)
  if let scopeId = scope.draftScopeId,
    let match = try? EVY.draftStore.draftMatch(splitProps: splitProps, scopeId: scopeId)
  {
    return (try match.draft.decoded(), match.remainingProps)
  }

  if let scopeId = scope.cacheScopeId,
    let cachedRow = try? EVY.cacheStore.get(
      namespace: EVYNamespace.cache, resource: scopeId, id: firstProp)
  {
    return (try cachedRow.decoded(), remainingProps)
  }

  // 2. Fall back to persistent store — synced API data
  let json: EVYJson
  do {
    json = try store.getJsonForBinding(key: firstProp, cacheScopeId: scope.cacheScopeId)
  } catch EVYDataError.keyNotFound {
    json = try EVY.getSyncedJsonForBinding(
      key: firstProp, cacheScopeId: scope.cacheScopeId)
  }
  return (json, remainingProps)
}

@MainActor
func _getDataFromProps(_ props: String, scope: EVYScope? = nil) throws -> EVYJson {
  let resolved = try _resolveBindingRoot(props, scope: scope)
  return resolved.root.parseProp(props: resolved.remainingProps)
}

@MainActor
func _getDataFromPropsStrict(_ props: String, scope: EVYScope? = nil) -> EVYJson? {
  guard let resolved = try? _resolveBindingRoot(props, scope: scope) else {
    return nil
  }
  return resolved.root.parsePropStrict(props: resolved.remainingProps)
}

@MainActor
func _getValueFromText(
  _ input: String,
  editing: Bool = false
) throws -> EVYValue {
  let match = try parseTextFromText(input, editing)
  return EVYValue(match.value, match.prefix, match.suffix)
}

@MainActor
func _evaluateFromText(_ input: String) throws -> Bool {
  // A standalone boolean literal carries no comparison operator, so it never
  // reaches the comparison path and would otherwise be resolved as a data path.
  if let literal = standaloneBooleanLiteral(in: input) {
    return literal
  }
  let match = try parseTextFromText(input)
  return match.value == "true"
}

private func standaloneBooleanLiteral(in input: String) -> Bool? {
  var trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.hasPrefix("{") && trimmed.hasSuffix("}") {
    trimmed = String(trimmed.dropFirst().dropLast())
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }
  switch trimmed {
  case "true": return true
  case "false": return false
  default: return nil
  }
}

func wrappedExpression(_ raw: String) -> String {
  raw.hasPrefix("{") ? raw : "{\(raw)}"
}

@MainActor
private func _resolvedText(fromSource source: String?, destination: String?, editing: Bool)
  -> String
{
  if let source {
    let trimmedSource = source.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedSource.isEmpty {
      return resolvedOrBlankedPerToken(trimmedSource, editing: editing)
    }
  }

  guard let destination else { return "" }
  let trimmedDestination = destination.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmedDestination.isEmpty else { return "" }

  let wrapped = wrappedExpression(trimmedDestination)
  return resolvedOrBlankedPerToken(wrapped, editing: editing)
}

/// Resolves `text` whole, falling back to resolving each `{…}` token on its own.
///
/// The core resolver throws on an unresolvable root, so coalescing that throw
/// for the whole string used to erase the literal text around a bad token too.
/// Resolving token by token on the failure path keeps everything that did
/// resolve and blanks only what did not. The happy path is unchanged: the
/// whole-string pass also handles brace-less function text and mixed
/// function/text expressions, whose semantics we do not re-derive per token.
@MainActor
private func resolvedOrBlankedPerToken(_ text: String, editing: Bool) -> String {
  if let resolved = try? _getValueFromText(text, editing: editing).toString() {
    return resolved
  }

  let blocks = interpolations(in: text)
  guard !blocks.isEmpty else { return "" }

  var output = text
  for block in blocks {
    let resolved =
      (try? _getValueFromText(block.fullMatch, editing: editing).toString()) ?? ""
    output = output.replacingOccurrences(of: block.fullMatch, with: resolved)
  }
  return output
}

@MainActor
func _displayText(fromSource source: String?, destination: String?) -> String {
  _resolvedText(fromSource: source, destination: destination, editing: false)
}

@MainActor
func _editableText(fromSource source: String?, destination: String?) -> String {
  _resolvedText(fromSource: source, destination: destination, editing: true)
}

@MainActor
func _watchTargets(forSource source: String?, destination: String?) -> [String] {
  var targets: [String] = []
  if let source {
    targets.append(contentsOf: _watchTargets(for: source))
  }
  if let destination {
    targets.append(contentsOf: _watchTargets(for: destination))
  }
  return targets
}

@MainActor
func _displayText(forDatum datum: EVYJson, valueTemplate: String?) throws -> String {
  guard let valueTemplate, !valueTemplate.isEmpty else {
    return datum.toString()
  }
  return try _formatData(json: datum, format: valueTemplate)
}

@MainActor
func _formatData(json: EVYJson, format: String) throws -> String {
  if format.count < 1 { return "" }

  let temporaryId = UUID().uuidString
  let formatWithNewData =
    format
    .replacingOccurrences(of: EVY.datumPrefix, with: "\(temporaryId).")
    .replacingOccurrences(of: "$datum", with: temporaryId)

  if formatWithNewData.isEmpty { return "" }

  ephemeralDatumRegistry[temporaryId] = json
  defer {
    ephemeralDatumRegistry.removeValue(forKey: temporaryId)
  }

  let returnText = try _getValueFromText(formatWithNewData)
  return returnText.toString()
}

// MARK: - Private parsing

@MainActor
private func parseText(
  _ input: EVYValue,
  _ editing: Bool,
  _ scope: EVYScope? = nil
) throws -> EVYValue {
  if input.value.isEmpty {
    return input
  }

  if let (fullMatch, comparison) = parseComparisonFromText(input.value) {
    let comparisonResult = try evaluateBooleanExpression(comparison) { operand in
      let trimmedOperand = operand.trimmingCharacters(in: .whitespacesAndNewlines)
      // A quoted operand is a string literal, never a data path - the same rule
      // findFirst operands and if() branches already follow.
      if trimmedOperand.first == "\"", trimmedOperand.last == "\"", trimmedOperand.count >= 2 {
        return _stripOptionalSurroundingQuotes(trimmedOperand)
      }
      let parsedOperand = try parseText(EVYValue(trimmedOperand, nil, nil), editing, scope)
      if parsedOperand.value != trimmedOperand {
        return parsedOperand.value
      }
      if let propsValue = try? _getDataFromText("{\(trimmedOperand)}", scope: scope) {
        return propsValue.toString()
      }
      return parsedOperand.value
    }
    let parsedInput = input.value.replacingOccurrences(
      of: fullMatch,
      with: comparisonResult ? "true" : "false"
    )
    return try parseText(EVYValue(parsedInput, input.prefix, input.suffix), editing, scope)
  }

  // Mixed interpolation blocks are text expressions, not prop paths. Unwrap them before
  // function evaluation so `{formatDimension(width) x formatDimension(height)}` never
  // reaches `parseProps` as `{20cm x 30cm}`.
  if let expression = parseTextExpressionInterpolation(input.value) {
    let parsedInner = try parseText(EVYValue(expression.inner, nil, nil), editing, scope)
    let parsedInput = input.value.replacingOccurrences(
      of: expression.fullMatch,
      with: parsedInner.toString()
    )
    return try parseText(EVYValue(parsedInput, input.prefix, input.suffix), editing, scope)
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
      value = evyCount(funcArgs)
    case "length":
      value = evyLength(funcArgs)
    case "if":
      value = try evyIf(funcArgs)
    case "now":
      value = evyNow()
    case "formatCurrency":
      value = try evyFormatCurrency(funcArgs, editing)
    case "formatDimension":
      value = try evyFormatDimension(funcArgs, editing)
    case "formatWeight":
      value = try evyFormatWeight(funcArgs, editing)
    case "formatAddress":
      value = try evyFormatAddress(funcArgs)
    case "formatAddressLine1":
      value = try evyFormatAddressLine1(funcArgs)
    case "formatAddressLine2":
      value = try evyFormatAddressLine2(funcArgs)
    case "formatDecimal":
      value = try evyFormatDecimal(funcArgs, editing)
    case "formatMetricLength":
      value = try evyFormatMetricLength(funcArgs, editing)
    case "formatImperialLength":
      value = try evyFormatImperialLength(funcArgs, editing)
    case "formatDuration":
      value = try evyFormatDuration(funcArgs, editing)
    case "formatDatetime":
      value = try evyFormatDatetime(funcArgs, editing)
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
          returnSuffix ? value.suffix : input.suffix), editing, scope)
    }
  }

  if let (match, props) = parseProps(input.value) {
    let data = try _getDataFromProps(props, scope: scope)
    let parsedInput = input.value.replacingOccurrences(
      of: match.0.description,
      with: data.toString())
    return try parseText(EVYValue(parsedInput, input.prefix, input.suffix), editing, scope)
  }

  return input
}

private func parseProps(_ input: String) -> (Regex<AnyRegexOutput>.Match, String)? {
  if let match = try? firstMatch(input, pattern: propsPattern) {
    return (match, String(match.0.dropFirst().dropLast()))
  }
  return nil
}

private func parseTextExpressionInterpolation(_ input: String) -> (
  fullMatch: String, inner: String
)? {
  interpolations(in: input).first {
    containsMixedFunctionTextExpression($0.inner.trimmingCharacters(in: .whitespacesAndNewlines))
  }
}

private func containsMixedFunctionTextExpression(_ input: String) -> Bool {
  var remaining = input
  var functionCount = 0

  while let function = parseFunctionInText(remaining) {
    functionCount += 1
    remaining = advancePastFunction(function.match, in: remaining)
  }

  if functionCount > 1 { return true }

  // A single function with a prop continuation, like `findFirst(<resource>, id).value`,
  // is still a prop expression. Anything else around the function is literal text.
  let trimmedRemainder = remaining.trimmingCharacters(in: .whitespacesAndNewlines)
  return functionCount == 1 && !trimmedRemainder.isEmpty
    && !isPropContinuation(trimmedRemainder)
}

private func advancePastFunction(_ match: Regex<AnyRegexOutput>.Match, in string: String) -> String
{
  string.replacingOccurrences(
    of: match.0.description,
    with: "",
    range: string.startIndex..<match.range.upperBound
  )
}

private func isPropContinuation(_ input: String) -> Bool {
  var remaining = input

  while !remaining.isEmpty {
    if remaining.first == "." {
      remaining.removeFirst()
      let segment = remaining.prefix { character in
        character.isLetter || character.isNumber || character == "_"
      }
      guard !segment.isEmpty else { return false }
      remaining.removeFirst(segment.count)
      continue
    }

    guard remaining.first == "[", let closingIndex = remaining.firstIndex(of: "]") else {
      return false
    }
    let indexValue = remaining[remaining.index(after: remaining.startIndex)..<closingIndex]
    guard !indexValue.isEmpty, indexValue.allSatisfy(\.isNumber) else { return false }
    remaining.removeSubrange(remaining.startIndex...closingIndex)
  }

  return true
}

func containsInterpolation(_ text: String) -> Bool {
  !interpolations(in: text).isEmpty
}

private func interpolations(in input: String) -> [(fullMatch: String, inner: String)] {
  var results: [(fullMatch: String, inner: String)] = []
  var state = ParserScanState()
  var startIndex: String.Index?

  for index in input.indices {
    let character = input[index]

    if startIndex == nil, !state.isInString, state.isTopLevel, character == "{" {
      startIndex = index
    }

    state.scan(character)

    if let blockStartIndex = startIndex, !state.isInString, state.isTopLevel, character == "}" {
      let innerStart = input.index(after: blockStartIndex)
      results.append((String(input[blockStartIndex...index]), String(input[innerStart..<index])))
      startIndex = nil
    }
  }

  return results
}

/// Finds the first `{…}` block that is a comparison.
///
/// Block boundaries come from the shared scanner rather than a regex, so quotes
/// and nesting are respected: a quoted operand no longer stops a block being
/// recognised, and an operator inside quotes or parentheses is not a top-level
/// operator and so does not make a block a comparison.
private func parseComparisonFromText(_ input: String) -> (fullMatch: String, content: String)? {
  for block in interpolations(in: input) {
    let comparison = block.inner.trimmingCharacters(in: .whitespacesAndNewlines)
    if firstTopLevelComparison(in: comparison) != nil {
      return (block.fullMatch, comparison)
    }
  }
  return nil
}

private func evaluateBooleanExpression(
  _ input: String,
  resolver: (String) throws -> String
) throws -> Bool {
  try _evaluateBooleanExpression(input) { left, comparisonOperator, right in
    let resolvedLeft = try resolver(left)
    let resolvedRight = try resolver(right)
    return evyComparison(comparisonOperator, left: resolvedLeft, right: resolvedRight)
  }
}

func _evaluateBooleanExpression(
  _ input: String,
  atom: (_ left: String, _ op: String, _ right: String) throws -> Bool
) throws -> Bool {
  let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
  let orTerms = splitRespectingParens(trimmedInput, separator: "||")
  if orTerms.count > 1 {
    for term in orTerms {
      if try _evaluateBooleanExpression(term, atom: atom) {
        return true
      }
    }
    return false
  }

  let andTerms = splitRespectingParens(trimmedInput, separator: "&&")
  if andTerms.count > 1 {
    for term in andTerms {
      if try !_evaluateBooleanExpression(term, atom: atom) {
        return false
      }
    }
    return true
  }

  if isWrappedInParentheses(trimmedInput) {
    let innerExpression = String(trimmedInput.dropFirst().dropLast())
    return try _evaluateBooleanExpression(innerExpression, atom: atom)
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

  return try atom(left, comparisonOperator, right)
}

func _containsTopLevelBooleanSyntax(_ input: String) -> Bool {
  findFirstTopLevelPrefix(
    in: input,
    prefixes: comparisonOperators + ["&&", "||"]
  ) != nil
}

private func splitRespectingParens(_ input: String, separator: String) -> [String] {
  splitTopLevel(input, separator: separator, includingEmptyValues: true)
}

private func firstTopLevelComparison(in input: String) -> (opIndex: String.Index, op: String)? {
  findFirstTopLevelPrefix(in: input, prefixes: comparisonOperators)
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

private func isWrappedInParentheses(_ input: String) -> Bool {
  guard input.first == "(", input.last == ")" else {
    return false
  }

  var state = ParserScanState()
  for index in input.indices {
    state.scan(input[index])
    if state.parenDepth == 0 {
      return index == input.index(before: input.endIndex)
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

/// Compiled patterns, shared across every caller.
///
/// Regex compilation is not free and the same handful of patterns are used on
/// every resolution, so they are cached. Resolution is not confined to the main
/// actor - row formatting runs wherever its caller happens to be - so the cache
/// needs a lock rather than an unguarded global.
private final class RegexPatternCache: @unchecked Sendable {
  static let shared = RegexPatternCache()

  private let lock = NSLock()
  private var patterns: [String: Regex<AnyRegexOutput>] = [:]

  func regex(for pattern: String) throws -> Regex<AnyRegexOutput> {
    lock.lock()
    let cached = patterns[pattern]
    lock.unlock()
    if let cached { return cached }

    // Compiled outside the lock: two callers racing on a cold pattern both
    // compile it and the second overwrites an identical value, which is
    // cheaper than holding the lock across compilation.
    let compiled = try Regex(pattern)
    lock.lock()
    patterns[pattern] = compiled
    lock.unlock()
    return compiled
  }
}

private func regexForPattern(_ pattern: String) throws -> Regex<AnyRegexOutput> {
  try RegexPatternCache.shared.regex(for: pattern)
}

private func firstMatch(_ input: String, pattern: String) throws -> Regex<AnyRegexOutput>.Match? {
  let regex = try regexForPattern(pattern)
  return input.firstMatch(of: regex)
}

@MainActor
private func watchTargetOperand(_ operand: String) -> String? {
  let prop = operand.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !prop.isEmpty else { return nil }
  if prop == "true" || prop == "false" { return nil }
  if prop.hasPrefix("\"") || prop.hasPrefix("'") { return nil }
  if Double(prop) != nil { return nil }
  return EVY.stripLocalPrefix(EVY.stripApiPrefix(prop))
}

@MainActor
private func appendUniqueWatchTarget(_ target: String?, to paths: inout [String]) {
  guard let target, !target.isEmpty else { return }
  if !paths.contains(target) {
    paths.append(target)
  }
}

@MainActor
func _watchTargets(for text: String) -> [String] {
  var paths: [String] = []
  appendWatchTargets(from: text, to: &paths)
  return paths
}

@MainActor
private func appendWatchTargets(from text: String, to paths: inout [String]) {
  let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmed.isEmpty else { return }

  if let (_, comparison) = parseComparisonFromText(trimmed) {
    appendWatchTargets(fromExpression: comparison, to: &paths)
    return
  }

  if appendWatchTargetsFromInterpolations(in: trimmed, to: &paths) {
    return
  }

  appendWatchTargets(fromExpression: trimmed, to: &paths)
}

@MainActor
private func appendWatchTargetsFromInterpolations(in text: String, to paths: inout [String]) -> Bool
{
  let matches = interpolations(in: text)
  guard !matches.isEmpty else {
    return false
  }

  for match in matches {
    appendWatchTargets(fromExpression: match.inner, to: &paths)
  }
  return true
}

@MainActor
private func appendWatchTargets(fromExpression expression: String, to paths: inout [String]) {
  let cleaned = expression.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !cleaned.isEmpty else { return }

  let orTerms = splitRespectingParens(cleaned, separator: "||")
  if orTerms.count > 1 {
    for term in orTerms {
      appendWatchTargets(fromExpression: term, to: &paths)
    }
    return
  }

  let andTerms = splitRespectingParens(cleaned, separator: "&&")
  if andTerms.count > 1 {
    for term in andTerms {
      appendWatchTargets(fromExpression: term, to: &paths)
    }
    return
  }

  if isWrappedInParentheses(cleaned) {
    appendWatchTargets(fromExpression: String(cleaned.dropFirst().dropLast()), to: &paths)
    return
  }

  if let (left, _, right) = parseAtomicComparison(cleaned) {
    appendWatchTargets(fromExpression: left, to: &paths)
    appendWatchTargets(fromExpression: right, to: &paths)
    return
  }

  if appendWatchTargetsFromFunctions(in: cleaned, to: &paths) {
    return
  }

  appendUniqueWatchTarget(watchTargetOperand(cleaned), to: &paths)
}

@MainActor
private func appendWatchTargetsFromFunctions(in text: String, to paths: inout [String]) -> Bool {
  var remaining = text
  var foundFunction = false

  while let functionCall = parseFunctionInText(remaining) {
    foundFunction = true
    for argument in _splitFunctionArguments(functionCall.functionArgs) {
      appendWatchTargets(fromExpression: argument, to: &paths)
    }
    remaining = advancePastFunction(functionCall.match, in: remaining)
  }

  return foundFunction
}
