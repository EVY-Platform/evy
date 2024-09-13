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
    
    static func getValueFromText(_ input: String, editing: Bool = false) -> EVYValue {
        do {
            let match = try EVYInterpreter.parseTextFromText(input, editing)
            return EVYValue(match.value, match.prefix, match.suffix)
        } catch {}
        
        return EVYValue(input, nil, nil)
    }
    
    static func parsePropsFromText(_ input: String) -> String {
        return EVYInterpreter.parsePropsFromText(input)
    }
    
    static func evaluateFromText(_ input: String) throws -> Bool {
        let match = try EVYInterpreter.parseTextFromText(input)
        return match.value == "true"
    }
    
    static func formatData(json: EVYJson, format: String, key: String) -> String {
        let temporaryId = UUID().uuidString
        let formatWithNewData = format
            .replacingOccurrences(of: "\(key).", with: "\(temporaryId).")
            .replacingOccurrences(of: ".\(key)", with: ".\(temporaryId)")
            .replacingOccurrences(of: "(\(key))", with: "(\(temporaryId))")
        
        if formatWithNewData.isEmpty {
            return json.displayValue()
        }
        
        do {
            let encodedData = try JSONEncoder().encode(json)
            try data.create(key: temporaryId, data: encodedData)
            let returnText = getValueFromText(formatWithNewData)
            try data.delete(key: temporaryId)
            return returnText.toString()
        } catch {
            return json.displayValue()
        }
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
        try updateData("\"\(value)\"".data(using: .utf8)!, at: at)
    }
    
    static func updateData(_ newData: Data, at: String) throws -> Void {
        let props = EVYInterpreter.parsePropsFromText(at)
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        let firstProp = splitProps.first!
        
        if data.exists(key: firstProp) {
            let dataObj = try data.get(key: firstProp)
            try dataObj.updateDataWithData(newData, props: Array(splitProps[1...]))
            try data.update(props: splitProps, data: dataObj.data)
        } else {
            try data.create(key: firstProp, data: newData)
        }
    }
}
