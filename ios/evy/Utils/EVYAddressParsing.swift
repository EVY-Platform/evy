//
//  EVYAddressParsing.swift
//  evy
//

import Foundation

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

func evyAddressFields(
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
