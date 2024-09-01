//
//  EVY.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/6/2024.
//

import Foundation

public enum EVYParamError: Error {
    case invalidProps
}

extension String {
    var isNumber: Bool {
        let digitsCharacters = CharacterSet(charactersIn: "0123456789")
        return CharacterSet(charactersIn: self).isSubset(of: digitsCharacters)
    }
}


struct EVY {
    static let data = EVYDataManager()
    
    /**
     * Methods to get data from various sources and inputs
     */
    static func getDataFromText(_ input: String) throws -> EVYJson {
        let props = EVYInterpreter.parsePropsFromText(input)
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let data = try data.get(key: splitProps.first!)
        return data.decoded().parseProp(props: Array(splitProps[1...]))
    }
    
   static func getDataFromProps(_ props: String) throws -> EVYJson {
       let splitProps = try EVYInterpreter.splitPropsFromText(props)
       let data = try data.get(key: splitProps.first!)
       return data.decoded().parseProp(props: Array(splitProps[1...]))
   }
    
    static func getValueFromText(_ input: String) -> EVYValue {
        do {
            let match = try EVYInterpreter.parseTextFromText(input, nil, nil)
            return EVYValue(match.value, match.prefix, match.suffix)
        } catch {}
        
        return EVYValue(input, nil, nil)
    }
    
    static func getPropsFromText(_ input: String) throws -> String {
        return EVYInterpreter.parsePropsFromText(input)
    }
    
    static func evaluateFromText(_ input: String) throws -> Bool {
        let match = try EVYInterpreter.parseTextFromText(input, nil, nil)
        return match.value == "true"
    }
    
    /**
     * Submitting a new entity to the API
     */
    static func submit(key: String) throws -> Void {
        let existing = try data.get(key: key)
        existing.key = UUID().uuidString
        // TODO: Send to API
    }
    
    /**
     * Updating a nested value in an object by using props
     */
    static func updateValue(_ value: String, at: String) throws -> Void {
        let props = EVYInterpreter.parsePropsFromText(at)
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let firstProp = splitProps.first!
        
        if data.exists(key: firstProp) {
            let data = try data.get(key: firstProp)
            let newValueAsData =
                switch value {
                case "true":
                    "\(value)".data(using: .utf8)!
                case "false":
                    "\(value)".data(using: .utf8)!
                default:
                    if value.isNumber {
                        "\(value)".data(using: .utf8)!
                    } else {
                        "\"\(value)\"".data(using: .utf8)!
                    }
                }
            try data.updateDataWithData(newValueAsData, props: Array(splitProps[1...]))
        } else {
            let valueAsData = try JSONEncoder().encode(value)
            try data.create(key: firstProp, data: valueAsData)
        }
    }
    
    /**
     * Updating a nested values in an object by using props
     */
    static func updateValues(_ values: Data, at: String) throws -> Void {
        let props = EVYInterpreter.parsePropsFromText(at)
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let firstProp = splitProps.first!
        
        if data.exists(key: firstProp) {
            let data = try data.get(key: splitProps.first!)
            try data.updateDataWithData(values, props: Array(splitProps[1...]))
        } else {
            try data.create(key: firstProp, data: values)
        }
    }
}
