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
    static func getDataNestedFromText(_ input: String) throws -> EVYJson {
        let (props, data) = try getRawDataNestedFromText(input)
        return data.decoded().parseProp(props: Array(props[1...]))
    }
    
   static func getDataNestedFromProps(_ input: String) throws -> EVYJson {
       let (props, data) = try getRawDataNestedFromProps(input)
       return data.decoded().parseProp(props: Array(props[1...]))
   }
    
    static func parseText(_ input: String) -> EVYValue {
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
        let (props, data) = try getRawDataNestedFromText(at)
        try data.updateValueInData(value, props: Array(props[1...]))
    }
    
    /**
     * Private utilities for accessing data
     */
    private static func getRawDataNestedFromText(_ input: String) throws -> (props: [String], EVYData) {
        let props = EVYInterpreter.parsePropsFromText(input)
        return try getRawDataNestedFromProps(props)
    }
    
    private static func getRawDataNestedFromProps(_ props: String) throws -> (props: [String], EVYData) {
        if props.count < 1 {
            throw EVYParamError.invalidProps
        }
        
        let splitProps = EVYInterpreter.splitPropsFromText(props)
        if splitProps.count < 1 {
            throw EVYParamError.invalidProps
        }
        
        return (splitProps, try data.get(key: splitProps.first!))
    }
}
