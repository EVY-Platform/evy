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
    
    static func createFromData(data: Data) throws -> [EVYData] {
        let json = try JSONDecoder().decode(EVYJson.self, from: data)
        switch json {
        case .string(_):
            throw EVYDataModelError.dataIsAString
        case .array(let arrayValue):
            var response: [EVYData] = []
            let encoder = JSONEncoder()
            for val in arrayValue {
                guard let valEncoded = try? encoder.encode(val) else {
                    throw EVYDataModelError.unprocessableValue
                }
                response.append(contentsOf: try createFromData(data: valEncoded))
            }
            return response
        case .dictionary(let dictValue):
            let res = try getValueAtKey(data: dictValue, prop: "id")
            switch res {
            case .string(let stringValue):
                return [EVYData(id: stringValue, data: data)]
            default:
                throw EVYDataModelError.idIsNotAString
            }
        }
    }
}

private func getValueAtKey(data: EVYJsonDict, prop: String) throws -> EVYJson {
    guard let subData = data[prop] else {
        throw EVYDataModelError.propertyNotFound
    }
    return subData
}
