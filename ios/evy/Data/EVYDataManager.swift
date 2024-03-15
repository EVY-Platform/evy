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
    case unknownVariable
    case emptyVariable
    case unstringifiableVariable
    case invalidVariable
}

let config = ModelConfiguration(isStoredInMemoryOnly: true)

struct EVYDataManager {
    static let i = EVYDataManager()
    
    private let container = try! ModelContainer(for: EVYDataModel.self, configurations: config)
    private var context: ModelContext?
    
    init(){
        context = ModelContext(container)
    }
    
    func create(id: String, data: Data) {
        context!.insert(EVYDataModel(id: id, data: data))
    }
    
    func getDataById(id: String, onCompletion: (_ data: EVYDataModel) -> Void) throws {
        let descriptor = FetchDescriptor<EVYDataModel>(predicate: #Predicate { $0.id == id })
        onCompletion(try context!.fetch(descriptor).first!)
    }
    
    func parse(_ input: String, onCompletion: (_ value: String) -> Void) {
        if (input.count < 1) { onCompletion(input) }
        
        else if let (match, functionName, functionArgs) = parseFunction(input) {
            if functionName == "count" {
                evyCount(functionArgs) { count in
                    
                    let parsedInput = input.replacingOccurrences(of: match.0.description, with: count)
                    parse(parsedInput, onCompletion: onCompletion)
                }
            }
        } else if let (match, props) = parseData(input) {
            try! parseProps(props) { data in
                if let parsedData = data?.toString() {
                    let parsedInput = input.replacingOccurrences(of: match.0.description, with: parsedData)
                    parse(parsedInput, onCompletion: onCompletion)
                }
            }
        }
        
        else { onCompletion(input) }
    }
    
    func parseProps(_ input: String, onCompletion: (EVYJson?) -> Void) throws {
        let variables = input.components(separatedBy: ".")
        
        if variables.count < 1 {
            onCompletion(nil)
        } else {
            let firstVariable = variables.first!
            
            try! EVYDataManager.i.getDataById(id: firstVariable) { data in
                onCompletion(try! parseProp(props: variables[1...], data: data.decoded()))
            }
        }
    }
}
    
func parsePropsWithData(_ input: String, data: EVYJson) -> String {
    let variables = input.components(separatedBy: ".")
    
    if variables.count > 0 {
        return try! parseProp(props: variables[0...], data: data).toString()
    }
    
    return input
}

func parseProp(props: [String].SubSequence, data: EVYJson) throws -> EVYJson {
    switch data {
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
    default:
        return data
    }
}

func parseData(_ input: String) -> (RegexMatch, String)? {
    if let match = firstMatch(input, pattern: "\\{(?!\")[^}^\"]*(?!\")\\}") {
        // Remove leading and trailing curly braces
        return (match, String(match.0.dropFirst().dropLast()))
    }
    return nil
}

func parseFunction(_ input: String) -> (match: RegexMatch,
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
    let conditions = DataConstants.conditions.data(using: .utf8)!
    EVYDataManager.i.create(id: "conditions", data: conditions)
    
    let conditionsObject = EVYDataModel(id: "conditions", data: conditions).decoded()
    
    switch conditionsObject {
    case .array(let arrayValue):
        return ScrollView {
            ForEach(arrayValue, id: \.self) { item in
                let parsed = parsePropsWithData("value", data: item)
                Text(parsed).padding()
            }
        }
    default:
        return Text(conditionsObject.toString())
    }
}
