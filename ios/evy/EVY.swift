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
        let parsed = EVYInterpreter.parseTextFromText(input)
        return EVYValue(parsed.value, parsed.prefix, parsed.suffix)
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
        let data = try data.get(key: splitProps.first!)
        try data.updateValueInData(value, props: Array(splitProps[1...]))
    }
}
