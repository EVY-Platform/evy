//
//  EVYData.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/2/2024.
//

import SwiftUI
import Foundation

typealias EVYJsonString = String
typealias EVYJsonArray = [EVYJson]
typealias EVYJsonDict = [String: EVYJson]

enum EVYDataParseError: Error {
    case unknownVariable
    case emptyVariable
    case unstringifiableVariable
    case invalidVariable
}

indirect enum EVYJson: Codable {
    case string(EVYJsonString)
    case dictionary(EVYJsonDict)
    case array(EVYJsonArray)
    
    init(from decoder: Decoder) throws {
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
        
        throw DecodingError.dataCorruptedError(in: container,
                                               debugDescription: "EVYJson value cannot be decoded")
    }
    
    func encode(to encoder: Encoder) throws {
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
}

extension Encodable {
    var stringified: String {
        get throws {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            guard let data = try? encoder.encode(self) else {
                throw EVYDataParseError.unstringifiableVariable
            }
            guard let string = String(data: data, encoding: .utf8) else {
                throw EVYDataParseError.unstringifiableVariable
            }
            return string
        }
    }
}

class EVYData {
    static let shared = EVYData()
    var store: [String: EVYJson] = [:]

    private init() {}
    
    public func set(name: String, data: Data) throws -> Void {
        store[name] = try! JSONDecoder().decode(EVYJson.self, from: data)
    }
    
    public func parse(_ input: String) throws -> String {
        if (input.count < 1) {
            throw EVYDataParseError.emptyVariable
        }
        
        let variables = input.components(separatedBy: ".")
        if variables.count > 1 {
            guard let firstVariable = variables.first else {
                throw EVYDataParseError.unknownVariable
            }
            guard let data = store[firstVariable] else {
                throw EVYDataParseError.unknownVariable
            }
            return try! parseProp(props: variables[1...], data: data)
        } else if (variables.count == 1) {
            guard let data = store[input] else {
                return "{\(input)}"
            }
            return try! data.stringified
        }
        
        throw EVYDataParseError.invalidVariable
    }

    public func parseProp(props: [String].SubSequence, data: EVYJson) throws -> String {
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
                return try parseProp(props: props[1...], data: subData)
            } else {
                throw EVYDataParseError.invalidVariable
            }
        }
    }
}

#Preview {
    let data = EVYData.shared
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)
    let string = try! data.parse("item.photos")
    return Text(string)
}
