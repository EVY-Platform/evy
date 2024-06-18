//
//  EVYInterpreter.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

private let comparisonBasePattern = "[a-zA-Z0-9.\\(\\) ]+"
private let comparisonOperatorPattern = "(>|<|==|!=)"
private let propsPattern = "\\{(?!\")[^}^\"]*(?!\")\\}"
private let functionParamsPattern = "\\(([^)]*)\\)"
private let functionPattern = "[a-zA-Z]+\(functionParamsPattern)"
private let propSeparator = "."

struct EVYInterpreter {
    public static func parsePropsFromText(_ input: String) -> String {
        guard let match = firstMatch(input, pattern: propsPattern) else {
            return input
        }
        
        // Remove leading and trailing curly braces
        return String(match.0.dropFirst().dropLast())
    }
    
    public static func splitPropsFromText(_ input: String) -> [String] {
        return input.components(separatedBy: propSeparator)
    }
    
    public static func parseTextFromText(_ input: String) -> (value: String,
                                                              prefix: String?,
                                                              suffix: String?)
    {
        do {
            let match = try parseText(input, nil, nil)
            return (match.value, match.prefix, match.suffix)
        } catch {}
        
        return (input, nil, nil)
    }
}

private func parseText(_ input: String,
                       _ prefix: String?,
                       _ suffix: String?) throws -> EVYFunctionOutput {
    if (input.count < 1) {
        return (input, prefix, suffix)
    }
    
    if let (match, comparisonOperator, left, right) = parseComparisonFromText(input) {
        var parsedLeft = left
        var parsedRight = right
        
        do {
            if let leftData = try EVY.getDataNestedFromText(left) {
                parsedLeft = leftData.toString()
            }
        } catch {}
        
        do {
            if let rightData = try EVY.getDataNestedFromText(left) {
                parsedRight = rightData.toString()
            }
        } catch {}
        
        let comparisonResult = evyComparison(comparisonOperator,
                                             left: try parseText(parsedLeft, prefix, suffix).value,
                                             right: try parseText(parsedRight, prefix, suffix).value)
        let parsedInput = input.replacingOccurrences(of: match.0.description,
                                                     with: comparisonResult ? "true" : "false")
        return try parseText(parsedInput, prefix, suffix)
    }
    
    if let (match, functionName, functionArgs) = parseFunctionFromText(input) {
        let returnPrefix = match.startIndex == 0
        let returnSuffix = match.range.upperBound.utf16Offset(in: input) == input.count
        
        var value: EVYFunctionOutput?
        
        switch functionName {
        case "count":
            value = try evyCount(functionArgs)
        case "formatCurrency":
            value = try evyFormatCurrency(functionArgs)
        case "formatDimension":
            value = try evyFormatDimension(functionArgs)
        default:
            value = nil
        }
        
        if (value != nil) {
            let parsedInput = input.replacingOccurrences(
                of: match.0.description,
                with: "\(returnPrefix ? "" : value!.prefix ?? "")\(value!.value)"
            )
            return (try parseText(parsedInput,
                                  returnPrefix ? value!.prefix : prefix,
                                  returnSuffix ? value!.suffix : suffix)
            )
        }
    }
    
    if let (match, functionName, functionArgs) = parseFunctionInText(input) {
        let returnPrefix = match.startIndex == 0
        let returnSuffix = match.range.upperBound.utf16Offset(in: input) == input.count
        
        var value: EVYFunctionOutput?
        
        switch functionName {
        case "count":
            value = try evyCount(functionArgs)
        case "formatCurrency":
            value = try evyFormatCurrency(functionArgs)
        case "formatDimension":
            value = try evyFormatDimension(functionArgs)
        default:
            value = nil
        }
        
        if (value != nil) {
            let parsedInput = input.replacingOccurrences(
                of: match.0.description,
                with: "\(returnPrefix ? "" : value!.prefix ?? "")\(value!.value)"
            )
            return (try parseText(parsedInput,
                                  returnPrefix ? value!.prefix : prefix,
                                  returnSuffix ? value!.suffix : suffix)
            )
        }
    }
    
    if let (match, props) = parseProps(input) {
        let data = try EVY.getDataNestedFromProps(props)
        let parsedInput = input.replacingOccurrences(of: match.0.description,
                                                     with: data.toString())
        return try parseText(parsedInput, prefix, suffix)
    }
    
    return (input, prefix, suffix)
}

private func parseProps(_ input: String) -> (RegexMatch, String)? {
    if let match = firstMatch(input, pattern: propsPattern) {
        // Remove leading and trailing curly braces
        return (match, String(match.0.dropFirst().dropLast()))
    }
    return nil
}


private func parseComparisonFromText(_ input: String) -> (match: RegexMatch,
                                                          comparisonOperator: String,
                                                          left: String,
                                                          right: String)?
{
    guard let match = firstMatch(input,
                                 pattern: "\\{\(comparisonBasePattern) \(comparisonOperatorPattern) \(comparisonBasePattern)\\}") else {
        return nil
    }

    // Remove opening { from match
    let comparison = String(match.0.description)
    guard let leftMatch = firstMatch(comparison, pattern: "\\{\(comparisonBasePattern)") else {
        return nil
    }
    guard let rightMatch = firstMatch(comparison, pattern: "\(comparisonBasePattern)\\}") else {
        return nil
    }
    guard let operatorMatch = firstMatch(comparison, pattern: comparisonOperatorPattern) else {
        return nil
    }

    let leftMatchWithBracket = leftMatch.0.description.trimmingCharacters(in: .whitespacesAndNewlines)
    let left = leftMatchWithBracket.dropFirst()
    let rightMatchWithBracket = rightMatch.0.description.trimmingCharacters(in: .whitespacesAndNewlines)
    let right = rightMatchWithBracket.dropLast()
    let comparisonOperator = operatorMatch.0.description.trimmingCharacters(in: .whitespacesAndNewlines)

    return (match, comparisonOperator, String(left), String(right))
}

private func parseFunctionFromText(_ input: String) -> (match: RegexMatch,
                                        functionName: String,
                                        functionArgs: String)?
{
    guard let match = firstMatch(input, pattern: "\\{\(functionPattern)\\}") else {
        return nil
    }

    guard let (_, functionName, functionArgs) = parseFunctionInText(input) else {
        return nil
    }

    return (match, functionName, functionArgs)
}

private func parseFunctionInText(_ input: String) -> (match: RegexMatch,
                                                          functionName: String,
                                                          functionArgs: String)?
{
    guard let match = firstMatch(input, pattern: functionPattern) else {
        return nil
    }
    
    // Remove opening { from match
    let functionCall = match.0.description
    guard let argsAndParenthesisMatch = firstMatch(functionCall, pattern: functionParamsPattern) else {
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
    try! EVY.data.create(key: "item", data: item)
    
    let bare = "test"
    let data = "{item.title}"
    let parsedData = EVYInterpreter.parseTextFromText(data)
    let value = EVYValue(parsedData.value, parsedData.prefix, parsedData.suffix)
    
    let dataWithPrefix = "{formatCurrency(item.price)}"
    let parsedDataWithPrefix = EVYInterpreter.parseTextFromText(dataWithPrefix)
    let valueWithPrefix = EVYValue(parsedDataWithPrefix.value,
                                   parsedDataWithPrefix.prefix,
                                   parsedDataWithPrefix.suffix)

    let dataWithSuffix = "{formatDimension(item.dimension.width)}"
    let parsedDataWithSuffix = EVYInterpreter.parseTextFromText(dataWithSuffix)
    let valueWithSuffix = EVYValue(parsedDataWithSuffix.value,
                                   parsedDataWithSuffix.prefix,
                                   parsedDataWithSuffix.suffix)
    
    return VStack {
        Text(EVYInterpreter.parsePropsFromText(bare))
        Text(EVYInterpreter.parsePropsFromText(data))
        Text(value.toString())
        Text(valueWithPrefix.toString())
        Text(valueWithSuffix.toString())
    }
}
