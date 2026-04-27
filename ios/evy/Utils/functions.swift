//
//  functions.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation
import SwiftUI

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
func evyLength(_ args: String) throws -> EVYFunctionOutput {
  let res = try EVY.getDataFromProps(args)
  switch res {
  case .string(let stringValue):
    return EVYFunctionOutput(value: String(stringValue.count), prefix: nil, suffix: nil)
  default:
    return EVYFunctionOutput(value: args, prefix: nil, suffix: nil)
  }
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
  if mm > 1000 {
    let meters = Decimal(mm / 1000)
    let truncatedMeters = NSDecimalNumber(decimal: meters).intValue
    if meters == Decimal(integerLiteral: truncatedMeters) {
      return EVYFunctionOutput(value: "\(truncatedMeters)", prefix: nil, suffix: "m")
    }
    return EVYFunctionOutput(value: "\(meters)", prefix: nil, suffix: "m")
  }
  if mm > 100 {
    let cm = Decimal(mm / 10)
    let truncatedCM = NSDecimalNumber(decimal: cm).intValue
    if cm == Decimal(integerLiteral: truncatedCM) {
      return EVYFunctionOutput(value: "\(truncatedCM)", prefix: nil, suffix: "cm")
    }
    return EVYFunctionOutput(value: "\(cm)", prefix: nil, suffix: "cm")
  }

  let truncatedMM = NSDecimalNumber(integerLiteral: mm).intValue
  if mm == truncatedMM {
    return EVYFunctionOutput(value: "\(truncatedMM)", prefix: nil, suffix: "mm")
  }
  return EVYFunctionOutput(value: "\(mm)", prefix: nil, suffix: "mm")
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
func evyFormatAddress(_ args: String) throws -> EVYFunctionOutput {
  let res = try EVY.getDataFromProps(args)
  switch res {
  case .dictionary(let dictValue):
    guard let unit = dictValue["unit"],
      let street = dictValue["street"],
      let city = dictValue["city"],
      let postcode = dictValue["postcode"],
      let state = dictValue["state"]
    else {
      throw EVYError.formatFailed(
        type: "address", reason: "missing required fields (unit, street, city, postcode, or state)")
    }

    return EVYFunctionOutput(
      value: String(
        format: "%@ %@, %@\n%@, %@",
        unit.toString(),
        street.toString(),
        postcode.toString(),
        city.toString(),
        state.toString()),
      prefix: nil,
      suffix: nil
    )
  default:
    throw EVYError.formatFailed(type: "address", reason: "expected dictionary, got \(res)")
  }
}

@MainActor
private func evyJsonFromFirstArgument(args: String, errorType: String) throws -> EVYJson {
  let path = try evyTrimmedFirstPath(from: args, errorType: errorType)
  return try EVY.getDataFromProps(path)
}

@MainActor
private func evyTrimmedFirstPath(from args: String, errorType: String) throws -> String {
  let parts = splitFunctionArguments(args)
  guard let path = parts.first?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty
  else {
    throw EVYError.formatFailed(type: errorType, reason: "missing value argument")
  }
  return path
}

@MainActor
func evyFormatDecimal(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let parts = splitFunctionArguments(args)
  guard let path = parts.first?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty
  else {
    throw EVYError.formatFailed(type: "decimal", reason: "missing value argument")
  }
  let places: Int
  if parts.count >= 2 {
    let rawPlaces = stripOptionalSurroundingQuotes(parts[1])
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
func evyFormatMetricLength(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let res = try evyJsonFromFirstArgument(args: args, errorType: "metricLength")
  let mm = try evyMillimetres(from: res, errorType: "metricLength")

  if editing {
    return EVYFunctionOutput(value: "\(mm)", prefix: nil, suffix: nil)
  }

  let metres = Double(mm) / 1000.0
  let formatted = String(format: "%.2f", metres)
  return EVYFunctionOutput(value: formatted, prefix: nil, suffix: "m")
}

@MainActor
func evyFormatImperialLength(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let res = try evyJsonFromFirstArgument(args: args, errorType: "imperialLength")
  let mm = try evyMillimetres(from: res, errorType: "imperialLength")

  if editing {
    return EVYFunctionOutput(value: "\(mm)", prefix: nil, suffix: nil)
  }

  let feet = Double(mm) / 304.8
  let formatted = String(format: "%.2f", feet)
  return EVYFunctionOutput(value: formatted, prefix: nil, suffix: "ft")
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
func evyFormatDate(
  _ args: String,
  _ editing: Bool = false
) throws -> EVYFunctionOutput {
  let parts = splitFunctionArguments(args)
  guard parts.count >= 2 else {
    throw EVYError.formatFailed(type: "date", reason: "expected value and format pattern")
  }
  let path = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
  guard !path.isEmpty else {
    throw EVYError.formatFailed(type: "date", reason: "missing value argument")
  }
  let pattern = evyNormalizeDateFormatPattern(
    stripOptionalSurroundingQuotes(parts[1])
      .trimmingCharacters(in: .whitespacesAndNewlines)
  )
  guard !path.isEmpty, !pattern.isEmpty else {
    throw EVYError.formatFailed(type: "date", reason: "missing value or format pattern")
  }

  let res = try EVY.getDataFromProps(path)
  let isoString = try evyIso8601String(from: res, type: "date")

  if editing {
    return EVYFunctionOutput(value: isoString, prefix: nil, suffix: nil)
  }

  let date = try evyParseIso8601Date(isoString)
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  formatter.dateFormat = pattern
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

@MainActor
func evyBuildAddress(
  _ args: String,
  _ value: String
) throws -> Data {
  let existingData = try? EVY.getDataFromProps(args)
  let existingAddress: [String: EVYJson]
  if case .dictionary(let dictValue) = existingData {
    existingAddress = dictValue
  } else {
    existingAddress = [:]
  }

  let builtAddress = EVYJson.dictionary(
    evyAddressFields(from: value, existingAddress: existingAddress)
  )
  return try JSONEncoder().encode(builtAddress)
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

private func evyParseIso8601Date(_ isoString: String) throws -> Date {
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
  throw EVYError.formatFailed(type: "date", reason: "could not parse ISO 8601 date '\(isoString)'")
}

private func evyNumericValue(_ value: String) -> Decimal? {
  Decimal(string: value.trimmingCharacters(in: .whitespacesAndNewlines))
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

private func evyAddressFields(
  from value: String,
  existingAddress: [String: EVYJson]
) -> [String: EVYJson] {
  let requiredKeys = ["unit", "street", "city", "postcode", "state"]
  var addressFields = existingAddress

  for key in requiredKeys where addressFields[key] == nil {
    addressFields[key] = .string("")
  }

  let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmedValue.isEmpty {
    return addressFields
  }

  let parsedFields = evyParsedAddressFields(from: trimmedValue, existingAddress: addressFields)
  for (key, parsedValue) in parsedFields {
    addressFields[key] = .string(parsedValue)
  }

  return addressFields
}

private func evyParsedAddressFields(
  from value: String,
  existingAddress: [String: EVYJson]
) -> [String: String] {
  let normalizedValue = value.replacingOccurrences(of: "\r\n", with: "\n")
  let lines =
    normalizedValue
    .split(separator: "\n", omittingEmptySubsequences: true)
    .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }

  if lines.count >= 2 {
    return evyParsedTwoLineAddress(
      firstLine: lines[0],
      secondLine: lines[1],
      existingAddress: existingAddress
    )
  }

  let commaSeparatedParts =
    normalizedValue
    .split(separator: ",", omittingEmptySubsequences: true)
    .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }

  if commaSeparatedParts.count >= 2 {
    return evyParsedSingleLineAddress(
      firstPart: commaSeparatedParts[0],
      secondPart: commaSeparatedParts[1],
      existingAddress: existingAddress
    )
  }

  return [
    "unit": existingAddress["unit"]?.toString() ?? "",
    "street": normalizedValue,
    "city": existingAddress["city"]?.toString() ?? "",
    "postcode": existingAddress["postcode"]?.toString() ?? "",
    "state": existingAddress["state"]?.toString() ?? "",
  ]
}

private func evyParsedTwoLineAddress(
  firstLine: String,
  secondLine: String,
  existingAddress: [String: EVYJson]
) -> [String: String] {
  let firstLineParts =
    firstLine
    .split(separator: ",", omittingEmptySubsequences: true)
    .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
  let secondLineParts =
    secondLine
    .split(separator: ",", omittingEmptySubsequences: true)
    .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }

  let unitAndStreet = evyAddressUnitAndStreet(
    from: firstLineParts.first ?? firstLine,
    existingAddress: existingAddress
  )

  return [
    "unit": unitAndStreet.unit,
    "street": unitAndStreet.street,
    "city": secondLineParts.first ?? "",
    "postcode": firstLineParts.count > 1 ? firstLineParts[1] : "",
    "state": secondLineParts.count > 1 ? secondLineParts[1] : "",
  ]
}

private func evyParsedSingleLineAddress(
  firstPart: String,
  secondPart: String,
  existingAddress: [String: EVYJson]
) -> [String: String] {
  let unitAndStreet = evyAddressUnitAndStreet(
    from: firstPart,
    existingAddress: existingAddress
  )
  let locationParts =
    secondPart
    .split(separator: " ", omittingEmptySubsequences: true)
    .map(String.init)

  let postcode = locationParts.last ?? ""
  let state = locationParts.count > 1 ? locationParts[locationParts.count - 2] : ""
  let city =
    locationParts.count > 2
    ? locationParts.dropLast(2).joined(separator: " ")
    : ""

  return [
    "unit": unitAndStreet.unit,
    "street": unitAndStreet.street,
    "city": city,
    "postcode": postcode,
    "state": state,
  ]
}

private func evyAddressUnitAndStreet(
  from input: String,
  existingAddress: [String: EVYJson]
) -> (unit: String, street: String) {
  let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
  let existingStreet = existingAddress["street"]?.toString() ?? ""

  if !existingStreet.isEmpty, trimmedInput.hasSuffix(existingStreet) {
    let unit = String(trimmedInput.dropLast(existingStreet.count))
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return (unit, existingStreet)
  }

  let parts = trimmedInput.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
  if parts.count == 2 {
    return (String(parts[0]), String(parts[1]))
  }

  return ("", trimmedInput)
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

#Preview {
  AsyncPreview { asyncView in
    asyncView
  } view: {
    try! EVY.getUserData()
    try! await EVY.createItem()

    return VStack {
      EVYTextView("{formatDimension(item.dimensions.width)}")
      EVYTextView("a == a: {a == a}")
      EVYTextView("a == b: {a == b}")
      EVYTextView("1 == 2: {1 == 2}")
      EVYTextView("1 == 1: {1 == 1}")
      EVYTextView("1 != 1: {1 != 1}")
      EVYTextView("title == Amazing: {{item.title} == Amazing}")
      EVYTextView("title == Amazing Fridge: {{item.title} == Amazing Fridge}")
      EVYTextView("Amazing Fridge == title: {Amazing Fridge == {item.title}}")
      EVYTextView("count (title) == 13: {{count(item.title)} == 13}")
      EVYTextView("count (title) == 14: {{count(item.title)} == 14}")
      EVYTextView("count (title) > 0: {{count(item.title)} > 0}")
      EVYTextView("{formatAddress(user.address)}")
    }
  }
}
