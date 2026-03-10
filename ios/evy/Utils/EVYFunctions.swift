//
//  EVYFunctions.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation
import SwiftUI

public struct EVYFunctionOutput {
    public let value: String
    public let prefix: String?
    public let suffix: String?
}

@MainActor
func evyCount(_ args: String) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .string(stringValue):
        return EVYFunctionOutput(value: String(stringValue.count), prefix: nil, suffix: nil)
    case let .array(arrayValue):
        return EVYFunctionOutput(value: String(arrayValue.count), prefix: nil, suffix: nil)
    case let .int(intValue):
        return EVYFunctionOutput(value: String(intValue), prefix: nil, suffix: nil)
    case let .decimal(decimalValue):
        return EVYFunctionOutput(value: "\(decimalValue)", prefix: nil, suffix: nil)
    default:
        return EVYFunctionOutput(value: args, prefix: nil, suffix: nil)
    }
}

@MainActor
func evyLength(_ args: String) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .string(stringValue):
        return EVYFunctionOutput(value: String(stringValue.count), prefix: nil, suffix: nil)
    default:
        return EVYFunctionOutput(value: args, prefix: nil, suffix: nil)
    }
}

@MainActor
func evyFormatCurrency(_ args: String,
                       _ editing: Bool = false) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    
    let rawValue: String
    switch res {
    case let .dictionary(dictValue):
        guard let value = dictValue["value"] else {
            throw EVYError.formatFailed(type: "currency", reason: "missing 'value' field")
        }
        rawValue = value.toString()
    case let .string(stringValue):
        rawValue = stringValue
    case let .int(intValue):
        rawValue = String(intValue)
    case let .decimal(decimalValue):
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
        throw EVYError.formatFailed(type: "currency", reason: "could not parse number from '\(trimmedValue)'")
    }
    return EVYFunctionOutput(value: String(format: "%.2f", CGFloat(truncating: number)), prefix: "$", suffix: nil)
}

@MainActor
func evyFormatDimension(_ args: String,
                        _ editing: Bool = false) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    
    let mm: Int
    switch res {
    case let .int(intValue):
        mm = intValue
    case let .string(stringValue):
        let trimmedValue = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedValue.isEmpty {
            return EVYFunctionOutput(value: "", prefix: nil, suffix: nil)
        }
        guard let parsedValue = Int(trimmedValue) else {
            throw EVYError.formatFailed(type: "dimension", reason: "could not parse integer from '\(trimmedValue)'")
        }
        mm = parsedValue
    default:
        throw EVYError.formatFailed(type: "dimension", reason: "expected integer, got \(res)")
    }
    
    if editing {
        return EVYFunctionOutput(value: "\(mm)", prefix: nil, suffix: nil)
    }
    if mm > 1000 {
        let meters = Decimal(mm/1000)
        let truncatedMeters = NSDecimalNumber(decimal: meters).intValue
        if meters == Decimal(integerLiteral: truncatedMeters) {
            return EVYFunctionOutput(value: "\(truncatedMeters)", prefix: nil, suffix: "m")
        }
        return EVYFunctionOutput(value: "\(meters)", prefix: nil, suffix: "m")
    }
    if mm > 100 {
        let cm = Decimal(mm/10)
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
func evyFormatWeight(_ args: String,
                     _ editing: Bool = false) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .string(stringValue):
        if editing {
            return EVYFunctionOutput(value: stringValue, prefix: nil, suffix: nil)
        }
        guard let mg = Decimal(string: stringValue) else {
            throw EVYError.formatFailed(type: "weight", reason: "could not parse decimal from '\(stringValue)'")
        }
        if mg > 1000000 {
            let kg = mg/1000000
            let truncatedKG = NSDecimalNumber(decimal: kg).intValue
            if kg == Decimal(integerLiteral: truncatedKG) {
                return EVYFunctionOutput(value: "\(truncatedKG)", prefix: nil, suffix: "kg")
            }
            return EVYFunctionOutput(value: "\(kg)", prefix: nil, suffix: "kg")
        }
        if mg > 1000 {
            let gram = mg/1000
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
    default:
        throw EVYError.formatFailed(type: "weight", reason: "expected string, got \(res)")
    }
}

@MainActor
func evyFormatAddress(_ args: String) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .dictionary(dictValue):
        guard let unit = dictValue["unit"],
              let street = dictValue["street"],
              let city = dictValue["city"],
              let postcode = dictValue["postcode"],
              let state = dictValue["state"]
        else {
            throw EVYError.formatFailed(type: "address", reason: "missing required fields (unit, street, city, postcode, or state)")
        }

        return EVYFunctionOutput(
            value: String(format: "%@ %@, %@\n%@, %@",
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
func evyBuildCurrency(_ args: String,
                      _ value: String) throws -> Data {
    let existingCurrency = evyExistingCurrency(for: args) ?? "AUD"
    let builtCurrency = EVYJson.dictionary([
        "currency": .string(existingCurrency),
        "value": evyJsonValue(from: value)
    ])
    return try JSONEncoder().encode(builtCurrency)
}

@MainActor
func evyBuildAddress(_ args: String,
                     _ value: String) throws -> Data {
    let existingData = try? EVY.getDataFromProps(args)
    let existingAddress: [String: EVYJson]
    if case let .dictionary(dictValue) = existingData {
        existingAddress = dictValue
    } else {
        existingAddress = [:]
    }
    
    let builtAddress = EVYJson.dictionary(
        evyAddressFields(from: value, existingAddress: existingAddress)
    )
    return try JSONEncoder().encode(builtAddress)
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
          case let .dictionary(dictValue) = existingData,
          let currencyValue = dictValue["currency"]
    else {
        return nil
    }
    return currencyValue.toString()
}

private func evyAddressFields(from value: String,
                              existingAddress: [String: EVYJson]) -> [String: EVYJson] {
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

private func evyParsedAddressFields(from value: String,
                                    existingAddress: [String: EVYJson]) -> [String: String] {
    let normalizedValue = value.replacingOccurrences(of: "\r\n", with: "\n")
    let lines = normalizedValue
        .split(separator: "\n", omittingEmptySubsequences: true)
        .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
    
    if lines.count >= 2 {
        return evyParsedTwoLineAddress(
            firstLine: lines[0],
            secondLine: lines[1],
            existingAddress: existingAddress
        )
    }
    
    let commaSeparatedParts = normalizedValue
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
        "state": existingAddress["state"]?.toString() ?? ""
    ]
}

private func evyParsedTwoLineAddress(firstLine: String,
                                     secondLine: String,
                                     existingAddress: [String: EVYJson]) -> [String: String] {
    let firstLineParts = firstLine
        .split(separator: ",", omittingEmptySubsequences: true)
        .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
    let secondLineParts = secondLine
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
        "state": secondLineParts.count > 1 ? secondLineParts[1] : ""
    ]
}

private func evyParsedSingleLineAddress(firstPart: String,
                                        secondPart: String,
                                        existingAddress: [String: EVYJson]) -> [String: String] {
    let unitAndStreet = evyAddressUnitAndStreet(
        from: firstPart,
        existingAddress: existingAddress
    )
    let locationParts = secondPart
        .split(separator: " ", omittingEmptySubsequences: true)
        .map(String.init)
    
    let postcode = locationParts.last ?? ""
    let state = locationParts.count > 1 ? locationParts[locationParts.count - 2] : ""
    let city = locationParts.count > 2
        ? locationParts.dropLast(2).joined(separator: " ")
        : ""
    
    return [
        "unit": unitAndStreet.unit,
        "street": unitAndStreet.street,
        "city": city,
        "postcode": postcode,
        "state": state
    ]
}

private func evyAddressUnitAndStreet(from input: String,
                                     existingAddress: [String: EVYJson]) -> (unit: String, street: String) {
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

private func evyCompareValues<T: Comparable>(_ comparisonOperator: String,
                                             left: T,
                                             right: T) -> Bool
{
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
		try! await EVY.createItem()
		
		return VStack {
		EVYTextView("{formatDimension(width)}")
		EVYTextView("a == a: {a == a}")
		EVYTextView("a == b: {a == b}")
		EVYTextView("1 == 2: {1 == 2}")
		EVYTextView("1 == 1: {1 == 1}")
		EVYTextView("1 != 1: {1 != 1}")
		EVYTextView("title == Amazing: {{title} == Amazing}")
		EVYTextView("title == Amazing Fridge: {{title} == Amazing Fridge}")
		EVYTextView("Amazing Fridge == title: {Amazing Fridge == {title}}")
		EVYTextView("count (title) == 13: {{count(title)} == 13}")
		EVYTextView("count (title) == 14: {{count(title)} == 14}")
		EVYTextView("count (title) > 0: {{count(title)} > 0}")
		EVYTextView("{formatAddress(pickup_address)}")
		}
	}
}
