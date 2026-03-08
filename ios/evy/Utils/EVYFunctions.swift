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
    switch res {
    case let .dictionary(dictValue):
        guard let value = dictValue["value"] else {
            throw EVYError.formatFailed(type: "currency", reason: "missing 'value' field")
        }
        if editing {
            return EVYFunctionOutput(value: "\(value.toString())", prefix: nil, suffix: nil)
        }
        guard let number = NumberFormatter().number(from: value.toString()) else {
            throw EVYError.formatFailed(type: "currency", reason: "could not parse number from '\(value.toString())'")
        }
        return EVYFunctionOutput(value: String(format: "%.2f", CGFloat(truncating: number)), prefix: "$", suffix: nil)
    default:
        throw EVYError.formatFailed(type: "currency", reason: "expected dictionary, got \(res)")
    }
}

@MainActor
func evyFormatDimension(_ args: String,
                        _ editing: Bool = false) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
	case let .int(mm):
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
    default:
        throw EVYError.formatFailed(type: "dimension", reason: "expected integer, got \(res)")
    }
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

private func evyNumericValue(_ value: String) -> Decimal? {
    Decimal(string: value.trimmingCharacters(in: .whitespacesAndNewlines))
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
