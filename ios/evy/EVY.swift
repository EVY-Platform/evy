//
//  EVY.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/6/2024.
//

import Foundation

struct EVY {
    static let data = EVYDataManager()
    
    static func submit(key: String) throws -> Void {
        let existing = try data.get(key: key)
        existing.key = UUID().uuidString
        // TODO: Send to API
    }
    
    static func updateValue(_ value: String, at: String) throws -> Void {
        let props = EVYValue(at).props()
        if props.count < 1 {
            throw EVYDataParseError.invalidProps
        }
        
        let modelData = try data.get(key: props.first!)
        let valueAsData = "\"\(value)\"".data(using: .utf8)!
        let valueAsJson = try! JSONDecoder().decode(EVYJson.self, from: valueAsData)
        let updatedData = try getUpdatedData(props: Array(props[1...]),
                                             data: modelData.decoded(),
                                             value: valueAsJson)
        
        let newData = try JSONEncoder().encode(updatedData)
        try data.update(key: props.first!, data: newData)
    }
    
    static func getDataAt(input: String) throws -> EVYJson {
        let variables = input.components(separatedBy: ".")
        guard variables.count > 0 else {
            throw EVYDataParseError.invalidProps
        }
        
        let firstVariable = variables.first!
        let data = try data.get(key: firstVariable)
        return data.decoded().parseProp(props: Array(variables[1...]))
    }
    
    private static func getUpdatedData(props: [String], data: EVYJson, value: EVYJson) throws -> EVYJson {
        if props.count < 1 {
            return data
        }
        
        switch data {
        case .dictionary(var dictValue):
            guard let firstVariable = props.first else {
                throw EVYDataParseError.invalidProps
            }
            guard let subData = dictValue[firstVariable] else {
                throw EVYDataParseError.invalidVariable
            }
            if props.count == 1 {
                dictValue[firstVariable] = value
                let dictAsData = try JSONEncoder().encode(dictValue)
                return try JSONDecoder().decode(EVYJson.self, from: dictAsData)
            }
            let updatedData = try getUpdatedData(props: Array(props[1...]), data: subData, value: value)
            if (props.count > 1) {
                dictValue[firstVariable] = updatedData
                let dictAsData = try JSONEncoder().encode(dictValue)
                return try JSONDecoder().decode(EVYJson.self, from: dictAsData)
            }
            return updatedData
        default:
            return data
        }
    }
}

