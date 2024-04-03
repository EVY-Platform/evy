//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYTextView: View {
    let text: String
    
    init(_ text: String) {
        self.text = EVYTextView.parseText(text)
    }
    
    var body: some View {
        EVYTextView.parsedText(text).lineSpacing(Constants.spacing)
    }
    
    static func propsFromText(_ input: String) -> (RegexMatch, String)? {
        if let match = firstMatch(input, pattern: "\\{(?!\")[^}^\"]*(?!\")\\}") {
            // Remove leading and trailing curly braces
            return (match, String(match.0.dropFirst().dropLast()))
        }
        return nil
    }
    
    static func parsedText(_ input: String) -> Text {
        if input.count < 1 {
            return Text(input)
        }

        let regex = try! Regex("::[a-zA-Z.]+::")
            if let match = input.firstMatch(of: regex) {
            let imageStart = match.range.lowerBound
            let imageEnd = match.range.upperBound
            
            let imageName = match.0.trimmingCharacters(in: CharacterSet(charactersIn: ":"))
            let imageText = Text("\(Image(systemName: imageName))")
            
            let hasPrefix = imageStart > input.startIndex
            let hasSuffix = imageEnd < input.endIndex
            
            if hasPrefix && hasSuffix {
                let start = String(input.prefix(upTo: imageStart))
                let end = String(input.suffix(from: imageEnd))
                return self.parsedText(start) + imageText + self.parsedText(end)
            } else if hasPrefix {
                let start = String(input.prefix(upTo: imageStart))
                return self.parsedText(start) + imageText
            } else if hasSuffix {
                let end = String(input.suffix(from: imageEnd))
                return imageText + self.parsedText(end)
            } else {
                return imageText
            }
        }
        
        return Text(parseText(input)).font(.evy)
    }
    
    static func parseProps(_ input: String) throws -> EVYJson? {
        let variables = input.components(separatedBy: ".")
        if variables.count > 0 {
            let firstVariable = variables.first!
            
            if let data = EVYDataManager.i.get(key: firstVariable) {
                let temp = data.decoded()
                return try parseProp(props: Array(variables[1...]), data: temp)
            }
        }
        return nil
    }
    
    static func parseText(_ input: String) -> String {
        if (input.count < 1) {
            return input
        }
        else if let (match, functionName, functionArgs) = parseFunctionFromText(input) {
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
        } else if let (match, props) = EVYTextView.propsFromText(input) {
            let data = try! EVYTextView.parseProps(props)
            if let parsedData = data?.toString() {
                let parsedInput = input.replacingOccurrences(of: match.0.description, with: parsedData)
                return parseText(parsedInput)
            }
        }
        
        return input
    }
}

private func parseProp(props: [String], data: EVYJson) throws -> EVYJson {
    if props.count < 1 {
        return data
    }
    
    switch data {
    case .dictionary(let dictValue):
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

private func parseFunctionFromText(_ input: String) -> (match: RegexMatch,
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
    return VStack {
        EVYTextView("::star.square.on.square.fill::")
        EVYTextView("Just text")
        EVYTextView("{item.title} ::star.square.on.square.fill:: and more text")
        EVYTextView("count: {count(item.photos)}")
        EVYTextView("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
    }
}
