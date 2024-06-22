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
    /**
     * Takes a string from the SDUI API
     * - extracts the 1st instance of props from it, stripping out brackets
     * - returns that props string
     */
    public static func parsePropsFromText(_ input: String) -> String {
        guard let match = firstMatch(input, pattern: propsPattern) else {
            return input
        }
        
        // Remove leading and trailing curly braces
        return String(match.0.dropFirst().dropLast())
    }
    
    /**
     * Takes a props string
     * - returns those props as a list
     */
    public static func splitPropsFromText(_ props: String) throws -> [String] {
        if props.count < 1 {
            throw EVYParamError.invalidProps
        }
        
        let splitProps = props.components(separatedBy: propSeparator)
        if splitProps.count < 1 {
            throw EVYParamError.invalidProps
        }
        return splitProps
    }
    
    /**
     * Takes a string from the SDUI API
     * - parses all data, functions and formatting
     * - returns a string ready for display to the user
     */
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

/**
 * Primary text parsing utility
 * Recursively parses everything inside, including data, comparisons, and formatting
 */
private func parseText(_ input: String,
                       _ prefix: String?,
                       _ suffix: String?) throws -> EVYFunctionOutput {
    if (input.count < 1) {
        return (input, prefix, suffix)
    }
    
    if let (match, comparisonOperator, left, right) = parseComparisonFromText(input) {
        let parsedLeftText = EVYInterpreter.parseTextFromText(left)
        let parsedLeftValue = EVYValue(parsedLeftText.value,
                                       parsedLeftText.prefix,
                                       parsedLeftText.suffix)
        
        let parsedRightText = EVYInterpreter.parseTextFromText(right)
        let parsedRightValue = EVYValue(parsedRightText.value,
                                       parsedRightText.prefix,
                                       parsedRightText.suffix)
        
        let leftValue = try parseText(parsedLeftValue.toString(), prefix, suffix).value
        let rightValue = try parseText(parsedRightValue.toString(), prefix, suffix).value
        let comparisonResult = evyComparison(comparisonOperator,
                                             left: leftValue,
                                             right: rightValue)
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
            let returnValuesToJoin = [
                returnPrefix ? "" : value!.prefix ?? "",
                value!.value,
                returnSuffix ? "" : value!.suffix ?? ""
            ]
            let parsedInput = input.replacingOccurrences(
                of: match.0.description,
                with: returnValuesToJoin.joined()
            )
            return try parseText(parsedInput,
                                 returnPrefix ? value!.prefix : prefix,
                                 returnSuffix ? value!.suffix : suffix)
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
            let returnValuesToJoin = [
                returnPrefix ? "" : value!.prefix ?? "",
                value!.value,
                returnSuffix ? "" : value!.suffix ?? ""
            ]
            let parsedInput = input.replacingOccurrences(
                of: match.0.description,
                with: returnValuesToJoin.joined()
            )
            return try parseText(parsedInput,
                                 returnPrefix ? value!.prefix : prefix,
                                 returnSuffix ? value!.suffix : suffix)
        }
    }
    
    if let (match, props) = parseProps(input) {
        let splitProps = try EVYInterpreter.splitPropsFromText(props)
        
        let firstVariable = splitProps.first!
        let data = try EVY.data.get(key: firstVariable)
        let decodedData = data.decoded().parseProp(props: Array(splitProps[1...]))
        
        let parsedInput = input.replacingOccurrences(of: match.0.description,
                                                     with: decodedData.toString())
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
    
    let selling_reasons = DataConstants.selling_reasons.data(using: .utf8)!
    try! EVY.data.create(key: "selling_reasons", data: selling_reasons)
    
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
    
    let dataWithSuffixAndRight = "{formatDimension(item.dimension.width)} - {item.title}"
    let parsedDataWithSuffixAndRight = EVYInterpreter.parseTextFromText(dataWithSuffixAndRight)
    let valueWithSuffixAndRight = EVYValue(parsedDataWithSuffixAndRight.value,
                                   parsedDataWithSuffixAndRight.prefix,
                                   parsedDataWithSuffixAndRight.suffix)
    
    let dataWithComparison = "{count(item.title) == count(selling_reasons)} v {count(item.title) == count(item.title)}"
    let parsedDataWithComparison = EVYInterpreter.parseTextFromText(dataWithComparison)
    let valueWithComparison = EVYValue(parsedDataWithComparison.value,
                                       parsedDataWithComparison.prefix,
                                       parsedDataWithComparison.suffix)
    
    return VStack {
        Text(EVYInterpreter.parsePropsFromText(bare))
        Text(EVYInterpreter.parsePropsFromText(data))
        Text(value.toString())
        Text(valueWithPrefix.toString())
        Text(valueWithSuffix.toString())
        Text(valueWithSuffixAndRight.toString())
        Text(valueWithComparison.toString())
    }
}
