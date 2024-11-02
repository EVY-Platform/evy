//
//  EVYFunctions.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation
import SwiftUI

public typealias EVYFunctionOutput = (value: String, prefix: String?, suffix: String?)

func evyCount(_ args: String) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .string(stringValue):
        return (String(stringValue.count), nil, nil)
    case let .array(arrayValue):
        return (String(arrayValue.count), nil, nil)
    default:
        return (args, nil, nil)
    }
}

func evyFormatCurrency(_ args: String,
                       _ editing: Bool = false) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .dictionary(dictValue):
        guard let value = dictValue["value"] else {
            return ("", nil, nil)
        }
        if editing {
            return ("\(value.toString())", nil, nil)
        }
        guard let number = NumberFormatter().number(from: value.toString()) else {
            return ("", nil, nil)
        }
        return (String(format: "%.2f", CGFloat(truncating: number)), "$", nil)
    default:
        return ("Invalid price data", nil, nil)
    }
}

func evyFormatDimension(_ args: String,
                        _ editing: Bool = false) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .string(stringValue):
        if editing {
            return (stringValue, nil, nil)
        }
        guard let mm = Decimal(string: stringValue) else {
            return ("", nil, nil)
        }
        if mm > 1000 {
            let meters = mm/1000
            let truncatedMeters = NSDecimalNumber(decimal: meters).intValue
            if meters == Decimal(integerLiteral: truncatedMeters) {
                return ("\(truncatedMeters)", nil, "m")
            }
            return ("\(meters)", nil, "m")
        }
        if mm > 100 {
            let cm = mm/10
            let truncatedCM = NSDecimalNumber(decimal: cm).intValue
            if cm == Decimal(integerLiteral: truncatedCM) {
                return ("\(truncatedCM)", nil, "cm")
            }
            return ("\(cm)", nil, "cm")
        }
        
        let truncatedMM = NSDecimalNumber(decimal: mm).intValue
        if mm == Decimal(integerLiteral: truncatedMM) {
            return ("\(truncatedMM)", nil, "mm")
        }
        return ("\(mm)", nil, "mm")
    default:
        return ("Could not format dimension", nil, nil)
    }
}

func evyFormatWeight(_ args: String,
                     _ editing: Bool = false) throws -> EVYFunctionOutput {
    let res = try EVY.getDataFromProps(args)
    switch res {
    case let .string(stringValue):
        if editing {
            return (stringValue, nil, nil)
        }
        guard let mg = Decimal(string: stringValue) else {
            return ("", nil, nil)
        }
        if mg > 1000000 {
            let kg = mg/1000000
            let truncatedKG = NSDecimalNumber(decimal: kg).intValue
            if kg == Decimal(integerLiteral: truncatedKG) {
                return ("\(truncatedKG)", nil, "kg")
            }
            return ("\(kg)", nil, "kg")
        }
        if mg > 1000 {
            let gram = mg/1000
            let truncatedGram = NSDecimalNumber(decimal: gram).intValue
            if gram == Decimal(integerLiteral: truncatedGram) {
                return ("\(truncatedGram)", nil, "g")
            }
            return ("\(gram)", nil, "g")
        }
        let truncatedMG = NSDecimalNumber(decimal: mg).intValue
        if mg == Decimal(integerLiteral: truncatedMG) {
            return ("\(truncatedMG)", nil, "mg")
        }
        return ("\(mg)", nil, "mg")
    default:
        return ("Could not format weight", nil, nil)
    }
}

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
            return (args, nil, nil)
        }

        return (String(format: "%@ %@, %@\n%@, %@",
                       unit.toString(),
                       street.toString(),
                       postcode.toString(),
                       city.toString(),
                       state.toString()), nil, nil)
    default:
        return ("Invalid address data", nil, nil)
    }
}

func evyComparison(_ comparisonOperator: String, left: String, right: String) -> Bool {
    switch comparisonOperator {
    case "==":
        return left == right
    case "!=":
        return left != right
    case "<":
        return left < right
    case ">":
        return left > right
    default:
        return false
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)

    return VStack {
        EVYTextView("a == a: {a == a}")
        EVYTextView("a == b: {a == b}")
        EVYTextView("1 == 2: {1 == 2}")
        EVYTextView("1 == 1: {1 == 1}")
        EVYTextView("1 != 1: {1 != 1}")
        EVYTextView("item.title == Amazing: {{item.title} == Amazing}")
        EVYTextView("item.title == Amazing Fridge: {{item.title} == Amazing Fridge}")
        EVYTextView("Amazing Fridge == item.title: {Amazing Fridge == {item.title}}")
        EVYTextView("count (item.title) == 13: {{count(item.title)} == 13}")
        EVYTextView("count (item.title) == 14: {{count(item.title)} == 14}")
        EVYTextView("count (item.title) > 0: {{count(item.title)} > 0}")
        EVYTextView("{formatAddress(item.address)}")
    }
}
