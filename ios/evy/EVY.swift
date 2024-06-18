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
    static func getDataFrom(input: String) throws -> EVYJson? {
        let props = EVYInterpreter.parsePropsFromText(input)
        guard props.count > 0 else {
            return nil
        }
        return try getDataAt(props: props)
    }
    
    static func getDataAt(props: String) throws -> EVYJson {
        let splitProps = EVYInterpreter.splitPropsFromText(props)
        guard splitProps.count > 0 else {
            throw EVYDataParseError.invalidProps
        }
        
        let firstVariable = splitProps.first!
        let data = try data.get(key: firstVariable)
        return data.decoded().parseProp(props: Array(splitProps[1...]))
    }
    
    static func getDataAtRootOf(_ props: String) -> EVYData? {
        let props = EVYInterpreter.splitPropsFromText(props)
        guard props.count > 0 else {
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
    
    static func getDataFromText(_ input: String) -> EVYData? {
        let props = EVYInterpreter.parsePropsFromText(input)
        guard props.count > 0 else {
            return nil
        }
        return getDataAtRootOf(props)
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
        guard props.count > 0 else {
            return
        }
        let splitProps = EVYInterpreter.splitPropsFromText(props)
        guard splitProps.count > 0 else {
            return
        }
        guard let modelData = getDataFromText(at) else {
            return
        }
        try modelData.updateValueInData(value, props: Array(splitProps[1...]))
    }
}

