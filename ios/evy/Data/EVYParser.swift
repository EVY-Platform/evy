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

struct EVYParser {
    static let instance = EVYParser()
    
    private let container = try! ModelContainer(for: EVYData.self, configurations: config)
    private var context: ModelContext?
    
    init(){
        context = ModelContext(container)
    }
    
    func create(id: String, data: Data) {
        context!.insert(EVYData(id: id, data: data))
    }
    
    func getDataById(id: String, onCompletion: (_ data: EVYData) -> Void) throws {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.id == id })
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
            
            try! EVYParser.instance.getDataById(id: firstVariable) { data in
                onCompletion(try! parseProp(props: variables[1...], data: data.decoded()))
            }
        }
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
    
    func parseText(_ input: String) -> String {
        return "parseText"
//        if let result = parseFunction(input) {
//            return "parseText"
////            return parseText(result)
//        } else if let (match, data) = parseData(input) {
//            let matchIdx = match.range.location
//            
//            let matchUpperBound = match.range.upperBound
//            let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
//            let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
//            let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
//            
//            let start = matchIdx > 0 ? parseText(String(input[...matchStartIndex])) : ""
//            let middle = parseText(data)
//            let end = matchUpperBound < input.count ? parseText(String(input[remainingIndex...])) : ""
//            
//            return start + middle + end
//        }
//        
//        return input
    }
    
    func parseData(_ input: String) -> (RegexMatch, String)? {
        if let match = firstMatch(input, pattern: "\\{([^}]*)\\}") {
            
            // Remove leading and trailing curly braces
            return (match, String(match.0.dropFirst().dropLast()))
        }
        
        return nil
    }
    
    func parseImage(_ input: String) -> (RegexMatch, Image)? {
//        if let match = firstMatch(input, pattern: "::([^::]*)::") {
//            let range = Range(match.range(at: 1), in: input)
//            return (match, Image(systemName: String(input[range!])))
//        }
        
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
}

private func firstMatch(_ input: String, pattern: String) -> RegexMatch? {
    do {
        let regex = try Regex(pattern)
        return input.firstMatch(of: regex)
    } catch {}
    
    return nil
}

struct EVYParserView: View {
    @State var text: String = "Loading"
    
    var body: some View {
        Text(text).onAppear {
            EVYParser.instance.parse("Hello {item.photos} {count(item.photos)}") { value in
                text = value
            }
        }
    }
}

#Preview {
//    return VStack {
//        EVYText("::star.square.on.square.fill::")
//        EVYText("Just text")
//        EVYText("{item.title}")
//        EVYText("{count(item.photos)}")
//        EVYText("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
//    }.modelContainer(container)
    
//    return Text(EVYParser.instance.parse("Hello {count(item.photos)}"))
    
    let item = DataConstants.item.data(using: .utf8)!
    EVYParser.instance.create(id: "item", data: item)
    
    return EVYParserView()
}
