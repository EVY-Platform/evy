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
        if let existing = try data.get(key: key) {
            existing.key = UUID().uuidString
            // TODO: Send to API
        } else {
            throw EVYDataError.keyNotFound
        }
    }
    
    static func updateValue(_ value: String, at: String) throws -> Void {
        guard let (_, props) = EVYValue(at).props else {
            throw EVYDataParseError.invalidProps
        }
            
        let variables = props.components(separatedBy: ".")
        guard variables.count > 1 else {
            throw EVYDataParseError.invalidProps
        }
        
        guard let modelData = try data.get(key: variables.first!) else {
            throw EVYDataError.keyNotFound
        }
        
        let valueAsData = "\"\(value)\"".data(using: .utf8)!
        let valueAsJson = try! JSONDecoder().decode(EVYJson.self, from: valueAsData)
        let updatedData = try getUpdatedData(props: Array(variables[1...]),
                                             data: modelData.decoded(),
                                             value: valueAsJson)
        
        let newData = try JSONEncoder().encode(updatedData)
        try data.update(key: variables.first!, data: newData)
    }
    
    static func parseProps(_ input: String) throws -> EVYJson? {
        let variables = input.components(separatedBy: ".")
        if variables.count > 0 {
            let firstVariable = variables.first!
            
            if let data = try data.get(key: firstVariable) {
                return try data.decoded().parseProp(props: Array(variables[1...]))
            }
        }
        return nil
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

