//
//  EVYJson.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData

public enum EVYDataParseError: Error {
    case invalidProps
    case invalidVariable
    case unprocessableValue
}

struct EVYValue {
    let value: String
    let prefix: String?
    let suffix: String?
    
    init(_ value: String, _ prefix: String?, _ suffix: String?) {
        self.value = value
        self.prefix = prefix
        self.suffix = suffix
    }
    
    func toString() -> String {
        return "\(prefix ?? "")\(value)\(suffix ?? "")"
    }
}

@Model
class EVYData {
    var key: String
    var data: Data
    
    init(key: String, data: Data) {
        self.key = key
        self.data = data
    }
    
    func decoded() -> EVYJson {
        return try! JSONDecoder().decode(EVYJson.self, from: self.data)
    }
    
    func updateValueInData(_ value: String, props: [String]) throws -> Void {
        let currentDataAsJson = self.decoded()
        if props.count < 1 {
            return
        }
        
        let newValueAsData = "\"\(value)\"".data(using: .utf8)!
        let newValueAsJson = try! JSONDecoder().decode(EVYJson.self, from: newValueAsData)
        
        let newJson = try getUpdatedJson(props: props, data: currentDataAsJson, value: newValueAsJson)
        self.data = try JSONEncoder().encode(newJson)
    }
    
    private func getUpdatedJson(props: [String], data: EVYJson, value: EVYJson) throws -> EVYJson {
        if props.count < 1 {
            return data
        }
        
        switch data {
        case .dictionary(var dictValue):
            guard let firstProp = props.first else {
                throw EVYDataParseError.invalidProps
            }
            guard let subData = dictValue[firstProp] else {
                throw EVYDataParseError.invalidProps
            }
            if props.count == 1 {
                dictValue[firstProp] = value
                let dictAsData = try JSONEncoder().encode(dictValue)
                return try JSONDecoder().decode(EVYJson.self, from: dictAsData)
            }
            let updatedData = try getUpdatedJson(props: Array(props[1...]), data: subData, value: value)
            if (props.count > 1) {
                dictValue[firstProp] = updatedData
                let dictAsData = try JSONEncoder().encode(dictValue)
                return try JSONDecoder().decode(EVYJson.self, from: dictAsData)
            }
            return updatedData
        default:
            return data
        }
    }
}

public typealias EVYJsonString = String
public typealias EVYJsonArray = [EVYJson]
public typealias EVYJsonDict = [String: EVYJson]

public enum EVYJson: Codable, Hashable {
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

        throw EVYDataParseError.unprocessableValue
    }
    
    public func hash(into hasher: inout Hasher) {
        hasher.combine(self.identifierValue())
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
    
    public func displayValue() -> String {
        switch self {
        case .dictionary(_):
            return self.parseProp(props: ["value"]).toString()
        default:
            return self.toString()
        }
    }
    
    public func identifierValue() -> String {
        switch self {
        case .dictionary(_):
            return self.parseProp(props: ["id"]).toString()
        default:
            return self.toString()
        }
    }
    
    public func parseProp(props: [String]) -> EVYJson {
        if props.count < 1 {
            return self
        }
        
        switch self {
        case .dictionary(let dictValue):
            guard let firstVariable = props.first else {
                return self
            }
            guard let subData = dictValue[firstVariable] else {
                return self
            }
            if props.count == 1 {
                return subData
            }
            
            return subData.parseProp(props: Array(props[1...]))
        default:
            return self
        }
    }
}
