//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation

public func parseEVYProp(props: [String].SubSequence, data: EVYJson) throws -> String {
    switch data {
    case .string(let stringValue):
        return stringValue
    case .array(let arrayValue):
        return try! arrayValue.stringified
    case .dictionary(let dictValue):
        if props.count >= 1 {
            guard let firstVariable = props.first else {
                throw EVYDataParseError.unknownVariable
            }
            guard let subData = dictValue[firstVariable] else {
                throw EVYDataParseError.invalidVariable
            }
            return try parseEVYProp(props: props[1...], data: subData)
        } else {
            throw EVYDataParseError.invalidVariable
        }
    }
}
