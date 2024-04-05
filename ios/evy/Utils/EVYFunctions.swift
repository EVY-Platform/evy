//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation

func evyCount(_ args: String) -> String {
    do {
        let res = try EVYDataManager.i.parseProps(args)
        switch res {
        case .array(let arrayValue):
            return String(arrayValue.count)
        default:
            return args
        }
    } catch {
        return args
    }
}

func evyFormatCurrency(_ args: String) -> String {
    do {
        let res = try EVYDataManager.i.parseProps(args)
        switch res {
        case .dictionary(let dictValue):
            guard let value = dictValue["value"] else {
                return args
            }
            return "$\(value.toString())"
        default:
            return "Could not calculate price"
        }
    } catch {
        return "Could not calculate price"
    }
}

func evyFormatDimension(_ args: String) -> String {
    do {
        let res = try EVYDataManager.i.parseProps(args)
        switch res {
        case .string(let stringValue):
            let floatValue = Float(stringValue)!
            if floatValue > 1000 {
                let meters = floatValue/1000
                if meters.truncatingRemainder(dividingBy: 1) == 0 {
                    return "\(Int(meters))m"
                }
                return "\(meters)m"
            }
            if floatValue > 100 {
                let cm = floatValue/10
                if cm.truncatingRemainder(dividingBy: 1) == 0 {
                    return "\(Int(cm))cm"
                }
                return "\(cm)cm"
            }
            if floatValue.truncatingRemainder(dividingBy: 1) == 0 {
                return "\(Int(floatValue))mm"
            }
            return "\(floatValue)mm"
        default:
            return args
        }
    } catch {
        return args
    }
}
