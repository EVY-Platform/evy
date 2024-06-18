//
//  EVY.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/6/2024.
//

import Foundation

struct EVY {
    static let data = EVYDataManager()
    
    /**
     * Methods to get data from various sources and inputs
     */
    static func getDataNestedFromText(_ input: String) throws -> EVYJson? {
        let props = EVYInterpreter.parsePropsFromText(input)
        if props.count < 1 {
            return nil
        }
        return try getDataNestedFromProps(props)
    }
    
    static func getDataNestedFromProps(_ input: String) throws -> EVYJson {
        let props = EVYInterpreter.splitPropsFromText(input)
        if props.count < 1 {
            throw EVYDataParseError.invalidProps
        }
        
        let firstVariable = props.first!
        let data = try data.get(key: firstVariable)
        return data.decoded().parseProp(props: Array(props[1...]))
    }
    
    static func getDataAtRootFromProps(_ input: String) -> EVYData? {
        let props = EVYInterpreter.splitPropsFromText(input)
        if props.count < 1 {
            return nil
        }
        guard let firstProp = props.first else {
            return nil
        }
        do {
            return try EVY.data.get(key: firstProp)
        } catch {}
        
        return nil
    }
    
    static func getDataAtRootFromText(_ input: String) -> EVYJson? {
        let data = getRawDataAtRootFromProps(input)
        return data?.decoded()
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
        let props = EVYInterpreter.parsePropsFromText(at)
        if props.count < 1 {
            return
        }
        let splitProps = EVYInterpreter.splitPropsFromText(props)
        if splitProps.count < 1 {
            return
        }
        guard let modelData = getRawDataAtRootFromProps(at) else {
            return
        }
        try modelData.updateValueInData(value, props: Array(splitProps[1...]))
    }
    
    private static func getRawDataAtRootFromProps(_ input: String) -> EVYData? {
        let props = EVYInterpreter.parsePropsFromText(input)
        if props.count < 1 {
            return nil
        }
        return getDataAtRootFromProps(props)
    }
}

