//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation
import SwiftUI

public typealias EVYFunctionOutput = (value: String, prefix: String?, suffix: String?)

func evyCount(_ args: String) -> EVYFunctionOutput {
    do {
        let res = try EVY.getDataAt(input: args)
        switch res {
        case .string(let stringValue):
            return (String(stringValue.count), nil, nil)
        case .array(let arrayValue):
            return (String(arrayValue.count), nil, nil)
        default:
            return (args, nil, nil)
        }
    } catch {
        return (args, nil, nil)
    }
}

func evyFormatCurrency(_ args: String) -> EVYFunctionOutput {
    do {
        let res = try EVY.getDataAt(input: args)
        switch res {
        case .dictionary(let dictValue):
            guard let value = dictValue["value"] else {
                return (args, nil, nil)
            }
            
            guard let number = NumberFormatter().number(from: value.toString()) else {
                return (args, nil, nil)
            }
            return (String(format: "%.2f", CGFloat(truncating: number)), "$", nil)
        default:
            return ("Invalid price data", nil, nil)
        }
    } catch {}
    
    return ("Could not calculate price", nil, nil)
}

func evyFormatDimension(_ args: String) -> EVYFunctionOutput {
    do {
        let res = try EVY.getDataAt(input: args)
        switch res {
        case .string(let stringValue):
            let floatValue = Float(stringValue)!
            if floatValue > 1000 {
                let meters = floatValue/1000
                if meters.truncatingRemainder(dividingBy: 1) == 0 {
                    return ("\(Int(meters))", nil, "m")
                }
                return ("\(meters)", nil, "m")
            }
            if floatValue > 100 {
                let cm = floatValue/10
                if cm.truncatingRemainder(dividingBy: 1) == 0 {
                    return ("\(Int(cm))", nil, "cm")
                }
                return ("\(cm)", nil, "cm")
            }
            if floatValue.truncatingRemainder(dividingBy: 1) == 0 {
                return ("\(Int(floatValue))", nil, "mm")
            }
            return ("\(floatValue)", nil, "mm")
        default:
            return ("Could not format dimension", nil, nil)
        }
    } catch {
        return ("Could not format dimension", nil, nil)
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
        EVYTextView("item.title == Amazing: {item.title == Amazing}")
        EVYTextView("item.title == Amazing Fridge: {item.title == Amazing Fridge}")
        EVYTextView("count (item.title) == 13: {count(item.title) == 13}")
        EVYTextView("count (item.title) == 14: {count(item.title) == 14}")
        EVYTextView("count (item.title) > 0: {count(item.title) > 0}")
    }
}
