//
//  EVYJson.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData
import SwiftUI

typealias RegexMatch = Regex<AnyRegexOutput>.Match

public enum EVYDataParseError: Error {
    case invalidProps
    case invalidVariable
}

public enum EVYDataError: Error {
    case keyAlreadyExists
    case keyNotFound
}

let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try! ModelContainer(for: EVYData.self, configurations: config)

struct EVYDataManager {
    static let i = EVYDataManager()
    
    private var context: ModelContext = ModelContext(container)
    
    public func create(key: String, data: Data) throws -> Void {
        if getDataByKey(key) != nil {
            throw EVYDataError.keyAlreadyExists
        }
        context.insert(EVYData(key: key, data: data))
    }
    
    public func update(key: String, data: Data) throws -> Void {
        if let existing = getDataByKey(key) {
            existing.data = data
        } else {
            throw EVYDataError.keyNotFound
        }
    }
    
    public func delete(key: String) throws -> Void {
        if let existing = getDataByKey(key) {
            context.delete(existing)
        } else {
            throw EVYDataError.keyNotFound
        }
    }
    
    public func submit(key: String) throws -> Void {
        if let existing = getDataByKey(key) {
            existing.key = UUID().uuidString
            // TODO: Send to API
        } else {
            throw EVYDataError.keyNotFound
        }
    }
    
    func getDataByKey(_ key: String) -> EVYData? {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
        do {
            return try context.fetch(descriptor).first
        } catch {
            return nil
        }
    }
    
    func parseText(_ input: String) -> String {
        if (input.count < 1) {
            return input
        }
        else if let (match, functionName, functionArgs) = getFunctionFromText(input) {
            if functionName == "count" {
                let count = evyCount(functionArgs)
                let parsedInput = input.replacingOccurrences(of: match.0.description, with: count)
                return parseText(parsedInput)
            }
            else if functionName == "formatCurrency" {
                let currencyAmount = evyFormatCurrency(functionArgs)
                let parsedInput = input.replacingOccurrences(of: match.0.description, with: currencyAmount)
                return parseText(parsedInput)
            }
        } else if let (match, props) = EVYDataManager.getPropsFromText(input) {
            let data = try! parseProps(props)
            if let parsedData = data?.toString() {
                let parsedInput = input.replacingOccurrences(of: match.0.description, with: parsedData)
                return parseText(parsedInput)
            }
        }
        
        return input
    }
    
    func parseProps(_ input: String) throws -> EVYJson? {
        let variables = input.components(separatedBy: ".")
        if variables.count > 0 {
            let firstVariable = variables.first!
            
            if let data = getDataByKey(firstVariable) {
                let temp = data.decoded()
                return try parseProp(props: Array(variables[1...]), data: temp)
            }
        }
        return nil
    }
    
    static func getPropsFromText(_ input: String) -> (RegexMatch, String)? {
        if let match = firstMatch(input, pattern: "\\{(?!\")[^}^\"]*(?!\")\\}") {
            // Remove leading and trailing curly braces
            return (match, String(match.0.dropFirst().dropLast()))
        }
        return nil
    }

}

private func parseProp(props: [String], data: EVYJson) throws -> EVYJson {
    switch data {
    case .dictionary(let dictValue):
        if props.count < 1 {
            return data
        }
        guard let firstVariable = props.first else {
            throw EVYDataParseError.invalidProps
        }
        guard let subData = dictValue[firstVariable] else {
            throw EVYDataParseError.invalidVariable
        }
        if props.count == 1 {
            return subData
        }
        
        return try parseProp(props: Array(props[1...]), data: subData)
    default:
        return data
    }
}

private func getFunctionFromText(_ input: String) -> (match: RegexMatch,
                                        functionName: String,
                                        functionArgs: String)?
{
    guard let match = firstMatch(input, pattern: "\\{[a-zA-Z]+\\(([^)]*)\\)\\}") else {
        return nil
    }
    
    // Remove opening { from match
    let functionCall = String(match.0.description.dropFirst())
    guard let argsAndParenthesisMatch = firstMatch(functionCall, pattern: "\\(([^)]*)\\)") else {
        return nil
    }
    
    let parenthesisStartIndex = argsAndParenthesisMatch.range.lowerBound
    let functionNameEndIndex = functionCall.index(before: parenthesisStartIndex)
    let functionName = functionCall[functionCall.startIndex...functionNameEndIndex]
    
    let argsAndParenthesis = argsAndParenthesisMatch.0.description
    let functionArgs = argsAndParenthesis.dropFirst().dropLast()

    return (match, String(functionName), String(functionArgs))
}

private func firstMatch(_ input: String, pattern: String) -> RegexMatch? {
    do {
        let regex = try Regex(pattern)
        return input.firstMatch(of: regex)
    } catch {}
    
    return nil
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(key: "item", data: item)
    
    let json =  SDUIConstants.inputPriceRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
