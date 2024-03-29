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
            return args
        }
    } catch {
        return args
    }
}
