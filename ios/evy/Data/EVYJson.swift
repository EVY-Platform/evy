//
//  EVYJson.swift
//  evy
//
//  Created by Geoffroy Lesage on 24/3/2024.
//

import Foundation

public typealias EVYJsonString = String
public typealias EVYJsonArray = [EVYJson]
public typealias EVYJsonDict = [String: EVYJson]

public enum EVYDataModelError: Error {
    case idIsNotAString
    case propertyNotFound
    case dataIsAString
    case unprocessableValue
}

public enum EVYJson: Codable {
    case string(EVYJsonString)
    case dictionary(EVYJsonDict)
    case array(EVYJsonArray)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let stringValue = try? container.decode(EVYJsonString.self) {
            self = .string(stringValue)
            return
        }

        if let dictionaryValue = try? container.decode(EVYJsonDict.self) {
            self = .dictionary(dictionaryValue)
            return
        }

        if let arrayValue = try? container.decode(EVYJsonArray.self) {
            self = .array(arrayValue)
            return
        }

        throw EVYDataModelError.unprocessableValue
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let jsonData):
            try container.encode(jsonData)
        case .dictionary(let jsonData):
            try container.encode(jsonData)
        case .array(let jsonData):
            try container.encode(jsonData)
        }
    }
    
    public func toString() -> String {
        let encoder = JSONEncoder()
        
        switch self {
        case .string(let stringValue):
            return stringValue
        case .array(let arrayValue):
            guard let data = try? encoder.encode(arrayValue) else {
                return arrayValue.description
            }
            guard let string = String(data: data, encoding: .utf8) else {
                return arrayValue.description
            }
            return string
        case .dictionary(let dictValue):
            guard let data = try? encoder.encode(dictValue) else {
                return dictValue.description
            }
            guard let string = String(data: data, encoding: .utf8) else {
                return dictValue.description
            }
            return string
        }
    }
}

private func getValueAtKey(data: EVYJsonDict, prop: String) throws -> EVYJson {
    guard let subData = data[prop] else {
        throw EVYDataModelError.propertyNotFound
    }
    return subData
}
