//
//  functions.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation

struct EVYFunctionOutput {
  let value: String
  let prefix: String?
  let suffix: String?
}

@MainActor
func evyCount(_ args: String) throws -> EVYFunctionOutput {
  let res = try EVY.getDataFromProps(args)
  switch res {
  case .string(let stringValue):
    return EVYFunctionOutput(value: String(stringValue.count), prefix: nil, suffix: nil)
  case .array(let arrayValue):
    return EVYFunctionOutput(value: String(arrayValue.count), prefix: nil, suffix: nil)
  case .int(let intValue):
    return EVYFunctionOutput(value: String(intValue), prefix: nil, suffix: nil)
  case .decimal(let decimalValue):
    return EVYFunctionOutput(value: "\(decimalValue)", prefix: nil, suffix: nil)
  default:
    return EVYFunctionOutput(value: args, prefix: nil, suffix: nil)
  }
}

@MainActor
func evyEarliestDatetime(_ args: String) throws -> EVYFunctionOutput {
  let res = try EVY.getDataFromProps(args)
  guard case .array(let items) = res else {
    return EVYFunctionOutput(value: "", prefix: nil, suffix: nil)
  }
  let dateStrings = items.compactMap { item -> String? in
    guard case .string(let value) = item, !value.isEmpty else { return nil }
    return value
  }
  let earliest = dateStrings.min() ?? ""
  return EVYFunctionOutput(value: earliest, prefix: nil, suffix: nil)
}

@MainActor
func evyNow() -> EVYFunctionOutput {
  EVYFunctionOutput(value: EVY.nowISO8601(), prefix: nil, suffix: nil)
}

@MainActor
private func recordPathValue(_ record: EVYJson, path: String) -> EVYJson? {
  guard let props = try? splitPropsFromText(path), !props.isEmpty else {
    return nil
  }
  return record.parsePropStrict(props: props)
}

@MainActor
private func recordPathIsNull(_ record: EVYJson, path: String) -> Bool {
  guard let value = recordPathValue(record, path: path) else {
    return true
  }
  if case .null = value {
    return true
  }
  return false
}

@MainActor
private func resolveFindFirstOperand(_ operand: String, record: EVYJson) -> String {
  if let recordValue = recordPathValue(record, path: operand) {
    return recordValue.toString()
  }
  if let dataValue = try? EVY.getDataFromProps(operand) {
    return dataValue.toString()
  }
  return _stripOptionalSurroundingQuotes(operand)
}

@MainActor
private func evaluateFindFirstAtom(
  left: String,
  op: String,
  right: String,
  record: EVYJson
) throws -> Bool {
  let leftIsNull = left == "null"
  let rightIsNull = right == "null"
  if leftIsNull || rightIsNull {
    guard op == "==" || op == "!=" else {
      throw EVYError.invalidData(
        context: "findFirst null comparisons only support == and !=")
    }
    if leftIsNull && rightIsNull {
      return op == "=="
    }
    let path = leftIsNull ? right : left
    let isNull = recordPathIsNull(record, path: path)
    return op == "==" ? isNull : !isNull
  }

  let resolvedLeft = resolveFindFirstOperand(left, record: record)
  let resolvedRight = resolveFindFirstOperand(right, record: record)
  return evyComparison(op, left: resolvedLeft, right: resolvedRight)
}

@MainActor
func evyFindFirst(_ args: String, remainingProps: [String] = []) throws -> EVYJson {
  let parts = _splitFunctionArguments(args)
  guard parts.count == 2 else { throw EVYParamError.invalidProps }
  let collectionArg = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
  let secondArg = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
  let collection = try EVY.getDataFromProps(collectionArg)
  guard case .array(let items) = collection else {
    return .string("")
  }

  let match: EVYJson?
  if _containsTopLevelBooleanSyntax(secondArg) {
    match = items.first { record in
      (try? _evaluateBooleanExpression(secondArg) { left, op, right in
        try evaluateFindFirstAtom(left: left, op: op, right: right, record: record)
      }) ?? false
    }
  } else {
    let idValue =
      (try? EVY.getDataFromProps(secondArg))?.toString()
      ?? _stripOptionalSurroundingQuotes(secondArg)
    match = items.first(where: { $0.identifierValue() == idValue })
  }

  guard let match else {
    return .string("")
  }
  return match.parseProp(props: remainingProps)
}

@MainActor
func evyIf(_ args: String) throws -> EVYFunctionOutput {
  let parts = _splitFunctionArguments(args)
  guard parts.count == 3 else { throw EVYParamError.invalidProps }
  let condition = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
  let trueBranch = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
  let falseBranch = parts[2].trimmingCharacters(in: .whitespacesAndNewlines)

  let conditionExpression = condition.hasPrefix("{") ? condition : "{\(condition)}"
  let isTrue = try _evaluateFromText(conditionExpression)
  let selectedBranch = isTrue ? trueBranch : falseBranch
  let resolved = try evyIfResolveBranch(selectedBranch)
  return EVYFunctionOutput(value: resolved, prefix: nil, suffix: nil)
}

@MainActor
private func evyIfResolveBranch(_ branch: String) throws -> String {
  let trimmed = branch.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.isEmpty || trimmed == "\"\"" {
    return ""
  }
  if trimmed.first == "\"", trimmed.last == "\"", trimmed.count >= 2 {
    return _stripOptionalSurroundingQuotes(trimmed)
  }
  let expression = trimmed.hasPrefix("{") ? trimmed : "{\(trimmed)}"
  return try _getValueFromText(expression).toString()
}

@MainActor
func evyFormatCurrency(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let res = try EVY.getDataFromProps(args)

  let rawValue: String
  switch res {
  case .dictionary(let dictValue):
    guard let value = dictValue["value"] else {
      throw EVYError.formatFailed(type: "currency", reason: "missing 'value' field")
    }
    rawValue = value.toString()
  case .string(let stringValue):
    rawValue = stringValue
  case .int(let intValue):
    rawValue = String(intValue)
  case .decimal(let decimalValue):
    rawValue = "\(decimalValue)"
  default:
    throw EVYError.formatFailed(type: "currency", reason: "expected dictionary, got \(res)")
  }

  let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmedValue.isEmpty {
    return EVYFunctionOutput(value: "", prefix: nil, suffix: nil)
  }
  if editing {
    return EVYFunctionOutput(value: trimmedValue, prefix: nil, suffix: nil)
  }
  guard let number = NumberFormatter().number(from: trimmedValue) else {
    throw EVYError.formatFailed(
      type: "currency", reason: "could not parse number from '\(trimmedValue)'")
  }
  return EVYFunctionOutput(
    value: String(format: "%.2f", CGFloat(truncating: number)), prefix: "$", suffix: nil)
}

@MainActor
private func scaledUnitOutput(
  value: Int,
  thresholds: [(minExclusive: Int, divisor: Int, suffix: String)],
  baseSuffix: String
) -> EVYFunctionOutput {
  for threshold in thresholds {
    if value > threshold.minExclusive {
      return EVYFunctionOutput(
        value: "\(value / threshold.divisor)", prefix: nil, suffix: threshold.suffix)
    }
  }
  return EVYFunctionOutput(value: "\(value)", prefix: nil, suffix: baseSuffix)
}

@MainActor
func evyFormatDimension(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let res = try EVY.getDataFromProps(args)

  let mm: Int
  switch res {
  case .int(let intValue):
    mm = intValue
  case .string(let stringValue):
    let trimmedValue = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmedValue.isEmpty {
      return EVYFunctionOutput(value: "", prefix: nil, suffix: nil)
    }
    guard let parsedValue = Int(trimmedValue) else {
      throw EVYError.formatFailed(
        type: "dimension", reason: "could not parse integer from '\(trimmedValue)'")
    }
    mm = parsedValue
  default:
    throw EVYError.formatFailed(type: "dimension", reason: "expected integer, got \(res)")
  }

  if editing {
    return EVYFunctionOutput(value: "\(mm)", prefix: nil, suffix: nil)
  }
  return scaledUnitOutput(
    value: mm,
    thresholds: [
      (1000, 1000, "m"),
      (100, 10, "cm"),
    ],
    baseSuffix: "mm"
  )
}

@MainActor
func evyFormatWeight(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let res = try EVY.getDataFromProps(args)

  let rawValue: String
  switch res {
  case .string(let stringValue):
    rawValue = stringValue
  case .int(let intValue):
    rawValue = String(intValue)
  case .decimal(let decimalValue):
    rawValue = "\(decimalValue)"
  default:
    throw EVYError.formatFailed(type: "weight", reason: "expected string or number, got \(res)")
  }

  let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmedValue.isEmpty {
    return EVYFunctionOutput(value: "", prefix: nil, suffix: nil)
  }
  if editing {
    return EVYFunctionOutput(value: trimmedValue, prefix: nil, suffix: nil)
  }
  guard let mg = Decimal(string: trimmedValue) else {
    throw EVYError.formatFailed(
      type: "weight", reason: "could not parse decimal from '\(trimmedValue)'")
  }
  if mg > 1_000_000 {
    let kg = mg / 1_000_000
    let truncatedKG = NSDecimalNumber(decimal: kg).intValue
    if kg == Decimal(integerLiteral: truncatedKG) {
      return EVYFunctionOutput(value: "\(truncatedKG)", prefix: nil, suffix: "kg")
    }
    return EVYFunctionOutput(value: "\(kg)", prefix: nil, suffix: "kg")
  }
  if mg > 1000 {
    let gram = mg / 1000
    let truncatedGram = NSDecimalNumber(decimal: gram).intValue
    if gram == Decimal(integerLiteral: truncatedGram) {
      return EVYFunctionOutput(value: "\(truncatedGram)", prefix: nil, suffix: "g")
    }
    return EVYFunctionOutput(value: "\(gram)", prefix: nil, suffix: "g")
  }
  let truncatedMG = NSDecimalNumber(decimal: mg).intValue
  if mg == Decimal(integerLiteral: truncatedMG) {
    return EVYFunctionOutput(value: "\(truncatedMG)", prefix: nil, suffix: "mg")
  }
  return EVYFunctionOutput(value: "\(mg)", prefix: nil, suffix: "mg")
}

@MainActor
private struct EVYAddressDisplayFields {
  let unit: String?
  let street: String?
  let postcode: String?
  let city: String?
  let state: String?

  var streetPortion: String {
    [unit, street]
      .compactMap { $0 }
      .filter { !$0.isEmpty }
      .joined(separator: " ")
  }

  static func fromDictionary(_ dictValue: [String: EVYJson]) -> EVYAddressDisplayFields {
    func trimmedField(_ key: String) -> String? {
      guard let value = dictValue[key] else { return nil }
      let trimmed = value.toString().trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? nil : trimmed
    }

    return EVYAddressDisplayFields(
      unit: trimmedField("unit"),
      street: trimmedField("street"),
      postcode: trimmedField("postcode"),
      city: trimmedField("city"),
      state: trimmedField("state")
    )
  }
}

@MainActor
private func evyAddressDisplayOutput(from args: String) throws -> EVYAddressDisplayFields {
  let res = try EVY.getDataFromProps(args)
  switch res {
  case .dictionary(let dictValue):
    return EVYAddressDisplayFields.fromDictionary(dictValue)
  default:
    throw EVYError.formatFailed(type: "address", reason: "expected dictionary, got \(res)")
  }
}

@MainActor
private func evyJoinedAddressParts(_ parts: [String?], separator: String) -> String {
  parts
    .compactMap { $0 }
    .filter { !$0.isEmpty }
    .joined(separator: separator)
}

@MainActor
func evyFormatAddressLine1(_ args: String) throws -> EVYFunctionOutput {
  let fields = try evyAddressDisplayOutput(from: args)
  return EVYFunctionOutput(value: fields.streetPortion, prefix: nil, suffix: nil)
}

@MainActor
func evyFormatAddressLine2(_ args: String) throws -> EVYFunctionOutput {
  let fields = try evyAddressDisplayOutput(from: args)
  let cityState = evyJoinedAddressParts([fields.city, fields.state], separator: ", ")
  let value = evyJoinedAddressParts([cityState, fields.postcode], separator: " ")
  return EVYFunctionOutput(value: value, prefix: nil, suffix: nil)
}

@MainActor
func evyFormatAddress(_ args: String) throws -> EVYFunctionOutput {
  let fields = try evyAddressDisplayOutput(from: args)
  let streetPortion = fields.streetPortion
  let locationPortion = evyJoinedAddressParts(
    [fields.postcode, fields.city, fields.state],
    separator: " "
  )

  let value: String
  if streetPortion.isEmpty {
    value = locationPortion
  } else if locationPortion.isEmpty {
    value = streetPortion
  } else {
    value = "\(streetPortion), \(locationPortion)"
  }

  return EVYFunctionOutput(value: value, prefix: nil, suffix: nil)
}

@MainActor
private func evyJsonFromFirstArgument(args: String, errorType: String) throws -> EVYJson {
  let parts = _splitFunctionArguments(args)
  guard let path = parts.first?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty
  else {
    throw EVYError.formatFailed(type: errorType, reason: "missing value argument")
  }
  return try EVY.getDataFromProps(path)
}

@MainActor
func evyFormatDecimal(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let parts = _splitFunctionArguments(args)
  guard let path = parts.first?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty
  else {
    throw EVYError.formatFailed(type: "decimal", reason: "missing value argument")
  }
  let places: Int
  if parts.count >= 2 {
    let rawPlaces = _stripOptionalSurroundingQuotes(parts[1])
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard let parsedPlaces = Int(rawPlaces), parsedPlaces >= 0, parsedPlaces <= 20 else {
      throw EVYError.formatFailed(type: "decimal", reason: "invalid fraction digits '\(rawPlaces)'")
    }
    places = parsedPlaces
  } else {
    places = 2
  }

  let res = try EVY.getDataFromProps(path)
  let number = try evyDoubleValue(from: res, type: "decimal")

  if editing {
    return EVYFunctionOutput(value: evyPlainNumberString(number), prefix: nil, suffix: nil)
  }

  let formatter = NumberFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.minimumFractionDigits = max(0, places)
  formatter.maximumFractionDigits = max(0, places)
  formatter.roundingMode = .halfUp
  formatter.numberStyle = .decimal
  guard let formatted = formatter.string(from: NSNumber(value: number)) else {
    throw EVYError.formatFailed(type: "decimal", reason: "could not format number")
  }
  return EVYFunctionOutput(value: formatted, prefix: nil, suffix: nil)
}

@MainActor
private func evyFormatLength(
  _ args: String,
  _ editing: Bool,
  errorType: String,
  divisor: Double,
  suffix: String
) throws -> EVYFunctionOutput {
  let res = try evyJsonFromFirstArgument(args: args, errorType: errorType)
  let mm = try evyMillimetres(from: res, errorType: errorType)
  if editing {
    return EVYFunctionOutput(value: "\(mm)", prefix: nil, suffix: nil)
  }
  let formatted = String(format: "%.2f", Double(mm) / divisor)
  return EVYFunctionOutput(value: formatted, prefix: nil, suffix: suffix)
}

@MainActor
func evyFormatMetricLength(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  try evyFormatLength(args, editing, errorType: "metricLength", divisor: 1000.0, suffix: "m")
}

@MainActor
func evyFormatImperialLength(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  try evyFormatLength(args, editing, errorType: "imperialLength", divisor: 304.8, suffix: "ft")
}

@MainActor
func evyFormatDuration(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let res = try evyJsonFromFirstArgument(args: args, errorType: "duration")
  let ms = try evyMilliseconds(from: res)

  if editing {
    return EVYFunctionOutput(value: "\(ms)", prefix: nil, suffix: nil)
  }

  let label = evyHumanizeDuration(milliseconds: ms)
  return EVYFunctionOutput(value: label, prefix: nil, suffix: nil)
}

@MainActor
func evyFormatDatetime(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  try evyFormatIsoDatetime(args, editing, errorType: "datetime")
}

@MainActor
private func evyFormatIsoDatetime(
  _ args: String,
  _ editing: Bool,
  errorType: String
) throws -> EVYFunctionOutput {
  let parts = _splitFunctionArguments(args)
  guard parts.count >= 2 else {
    throw EVYError.formatFailed(type: errorType, reason: "expected value and format pattern")
  }
  let path = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
  guard !path.isEmpty else {
    throw EVYError.formatFailed(type: errorType, reason: "missing value argument")
  }
  let pattern = evyNormalizeDateFormatPattern(
    _stripOptionalSurroundingQuotes(parts[1])
      .trimmingCharacters(in: .whitespacesAndNewlines)
  )
  guard !pattern.isEmpty else {
    throw EVYError.formatFailed(type: errorType, reason: "missing format pattern")
  }

  let res = try EVY.getDataFromProps(path)
  let isoString = try evyIso8601String(from: res, type: errorType)

  if editing {
    return EVYFunctionOutput(value: isoString, prefix: nil, suffix: nil)
  }

  let date = try evyParseIso8601Date(isoString, type: errorType)
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(secondsFromGMT: 0)

  var processedPattern = pattern
  if processedPattern.contains("o") {
    let calendar = Calendar(identifier: .gregorian)
    let components = calendar.dateComponents(in: TimeZone(secondsFromGMT: 0)!, from: date)
    if let day = components.day {
      let suffix = evyOrdinalSuffix(day: day)
      processedPattern = processedPattern.replacingOccurrences(of: "o", with: "'\(suffix)'")
    }
  }

  formatter.dateFormat = processedPattern
  let formatted = formatter.string(from: date)
  return EVYFunctionOutput(value: formatted, prefix: nil, suffix: nil)
}

@MainActor
func evyBuildCurrency(
  _ args: String,
  _ value: String
) throws -> Data {
  let existingCurrency = evyExistingCurrency(for: args) ?? "AUD"
  let builtCurrency = EVYJson.dictionary([
    "currency": .string(existingCurrency),
    "value": evyJsonValue(from: value),
  ])
  return try JSONEncoder().encode(builtCurrency)
}

private func evyDoubleValue(from json: EVYJson, type: String) throws -> Double {
  switch json {
  case .int(let intValue):
    return Double(intValue)
  case .decimal(let decimalValue):
    return NSDecimalNumber(decimal: decimalValue).doubleValue
  case .string(let stringValue):
    let trimmed = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let parsed = Double(trimmed) else {
      throw EVYError.formatFailed(type: type, reason: "could not parse number from '\(trimmed)'")
    }
    return parsed
  default:
    throw EVYError.formatFailed(type: type, reason: "expected number, got \(json)")
  }
}

private func evyPlainNumberString(_ value: Double) -> String {
  if value.truncatingRemainder(dividingBy: 1) == 0, value <= Double(Int.max),
    value >= Double(Int.min)
  {
    return String(Int(value))
  }
  return "\(value)"
}

private func evyMillimetres(from json: EVYJson, errorType: String) throws -> Int {
  switch json {
  case .int(let intValue):
    return intValue
  case .string(let stringValue):
    let trimmed = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      throw EVYError.formatFailed(type: errorType, reason: "empty millimetre value")
    }
    guard let mm = Int(trimmed) else {
      throw EVYError.formatFailed(
        type: errorType, reason: "could not parse integer from '\(trimmed)'")
    }
    return mm
  default:
    throw EVYError.formatFailed(
      type: errorType, reason: "expected integer millimetres, got \(json)")
  }
}

private func evyMilliseconds(from json: EVYJson) throws -> Int64 {
  switch json {
  case .int(let intValue):
    return Int64(intValue)
  case .decimal(let decimalValue):
    return NSDecimalNumber(decimal: decimalValue).int64Value
  case .string(let stringValue):
    let trimmed = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      throw EVYError.formatFailed(type: "duration", reason: "empty duration value")
    }
    guard let parsed = Int64(trimmed) else {
      throw EVYError.formatFailed(
        type: "duration", reason: "could not parse integer from '\(trimmed)'")
    }
    return parsed
  default:
    throw EVYError.formatFailed(
      type: "duration", reason: "expected duration in milliseconds, got \(json)")
  }
}

private func evyHumanizeDuration(milliseconds: Int64) -> String {
  let ms = max(milliseconds, 0)
  let units: [(Int64, String, String)] = [
    (86_400_000, "day", "days"),
    (3_600_000, "hour", "hours"),
    (60_000, "minute", "minutes"),
    (1000, "second", "seconds"),
  ]
  for (unitMs, singular, plural) in units {
    if ms >= unitMs {
      let count = ms / unitMs
      let label = count == 1 ? singular : plural
      return "\(count) \(label)"
    }
  }
  return "\(ms) milliseconds"
}

private func evyNormalizeDateFormatPattern(_ pattern: String) -> String {
  var result = pattern
  result = result.replacingOccurrences(of: "YYYY", with: "yyyy")
  result = result.replacingOccurrences(of: "DD", with: "dd")
  return result
}

private func evyOrdinalSuffix(day: Int) -> String {
  let lastTwoDigits = day % 100
  let lastDigit = day % 10
  if lastTwoDigits >= 11 && lastTwoDigits <= 13 { return "th" }
  switch lastDigit {
  case 1: return "st"
  case 2: return "nd"
  case 3: return "rd"
  default: return "th"
  }
}

private func evyIso8601String(from json: EVYJson, type: String) throws -> String {
  switch json {
  case .string(let stringValue):
    let trimmed = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      throw EVYError.formatFailed(type: type, reason: "empty date string")
    }
    return trimmed
  default:
    throw EVYError.formatFailed(type: type, reason: "expected ISO 8601 string, got \(json)")
  }
}

private func evyParseIso8601Date(_ isoString: String, type: String = "date") throws -> Date {
  let withFraction = ISO8601DateFormatter()
  withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let date = withFraction.date(from: isoString) {
    return date
  }
  let basic = ISO8601DateFormatter()
  basic.formatOptions = [.withInternetDateTime]
  if let date = basic.date(from: isoString) {
    return date
  }
  let localDateTime = DateFormatter()
  localDateTime.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
  localDateTime.locale = Locale(identifier: "en_US_POSIX")
  localDateTime.timeZone = TimeZone(secondsFromGMT: 0)
  if let date = localDateTime.date(from: isoString) {
    return date
  }
  throw EVYError.formatFailed(
    type: type, reason: "could not parse ISO 8601 date '\(isoString)'")
}

private let plainNumberRegex = try? Regex(#"^[+-]?(\d+(\.\d*)?|\.\d+)$"#)

private func evyNumericValue(_ value: String) -> Decimal? {
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  guard let plainNumberRegex, !trimmed.isEmpty, trimmed.wholeMatch(of: plainNumberRegex) != nil
  else { return nil }
  return Decimal(string: trimmed)
}

private func evyJsonValue(from value: String) -> EVYJson {
  let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmedValue.isEmpty {
    return .string("")
  }
  if let intValue = Int(trimmedValue) {
    return .int(intValue)
  }
  if let decimalValue = Decimal(string: trimmedValue) {
    return .decimal(decimalValue)
  }
  return .string(trimmedValue)
}

@MainActor
private func evyExistingCurrency(for props: String) -> String? {
  guard let existingData = try? EVY.getDataFromProps(props),
    case .dictionary(let dictValue) = existingData,
    let currencyValue = dictValue["currency"]
  else {
    return nil
  }
  return currencyValue.toString()
}

private func evyCompareValues<T: Comparable>(
  _ comparisonOperator: String,
  left: T,
  right: T
) -> Bool {
  switch comparisonOperator {
  case "==":
    return left == right
  case "!=":
    return left != right
  case "<":
    return left < right
  case ">":
    return left > right
  case "<=":
    return left <= right
  case ">=":
    return left >= right
  default:
    return false
  }
}

func evyComparison(_ comparisonOperator: String, left: String, right: String) -> Bool {
  if let leftNumber = evyNumericValue(left), let rightNumber = evyNumericValue(right) {
    return evyCompareValues(comparisonOperator, left: leftNumber, right: rightNumber)
  }

  return evyCompareValues(comparisonOperator, left: left, right: right)
}
