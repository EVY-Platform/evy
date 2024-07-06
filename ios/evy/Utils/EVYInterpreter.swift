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
private let arrayPattern = "\\[([\\d]*)\\]"
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
        
        var splitProps = props.components(separatedBy: propSeparator)
        if splitProps.count < 1 {
            throw EVYParamError.invalidProps
        }
        for i in splitProps.indices {
            if let matchArray = firstMatch(splitProps[i],
                                           pattern: arrayPattern)
            {
                splitProps[i].removeSubrange(matchArray.range)
                
                let matchIndex = String(matchArray.0.dropFirst().dropLast())
                splitProps.insert(matchIndex, at: i+1)
            }
        }
        return splitProps
    }
    
    /**
     * Takes a string from the SDUI API
     * - recursively parses all data, functions and formatting
     * - returns a string ready for display to the user
     */
    public static func parseTextFromText(_ input: String,
                                         _ prefix: String?,
                                         _ suffix: String?) throws -> EVYValue {
        if (input.count < 1) {
            return EVYValue(input, prefix, suffix)
        }
        
        if let (match, comparisonOperator, left, right) = parseComparisonFromText(input) {
            let parsedLeft = try parseTextFromText(left, prefix, suffix)
            let parsedRight = try parseTextFromText(right, prefix, suffix)
            let comparisonResult = evyComparison(comparisonOperator,
                                                 left: parsedLeft.value,
                                                 right: parsedRight.value)
            let parsedInput = input.replacingOccurrences(of: match.0.description,
                                                         with: comparisonResult ? "true" : "false")
            return try parseTextFromText(parsedInput, prefix, suffix)
        }
 
        if let (match, funcName, funcArgs) = parseFunctionFromText(input) ?? parseFunctionInText(input) {
            let returnPrefix = match.startIndex == 0
            let returnSuffix = match.range.upperBound.utf16Offset(in: input) == input.count
            
            let value: EVYFunctionOutput?
            
            switch funcName {
            case "count":
                value = try evyCount(funcArgs)
            case "formatCurrency":
                value = try evyFormatCurrency(funcArgs)
            case "formatDimension":
                value = try evyFormatDimension(funcArgs)
            case "formatWeight":
                value = try evyFormatWeight(funcArgs)
            case "formatAddress":
                value = try evyFormatAddress(funcArgs)
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
                return try parseTextFromText(parsedInput,
                                             returnPrefix ? value!.prefix : prefix,
                                             returnSuffix ? value!.suffix : suffix)
            }
        }
        
        if let (match, props) = parseProps(input) {
            let data = try EVY.getDataFromProps(props)
            let parsedInput = input.replacingOccurrences(of: match.0.description,
                                                         with: data.toString())
            return try parseTextFromText(parsedInput, prefix, suffix)
        }
        
        return EVYValue(input, prefix, suffix)
    }
}

private func parseProps(_ input: String) -> (RegexMatch, String)? {
    if let match = firstMatch(input, pattern: propsPattern) {
        // Remove leading and trailing curly braces
        return (match, String(match.0.dropFirst().dropLast()))
    }
    return nil
}

private func parseArrayFromProps(_ input: String) -> (RegexMatch, String)? {
    if let match = firstMatch(input, pattern: arrayPattern) {
        // Remove leading and trailing curly braces
        return (match, String(match.0))
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
    
    let parsedData = try! EVYInterpreter.parseTextFromText(
        data, nil, nil
    )
    let withPrefix = try! EVYInterpreter.parseTextFromText(
        "{formatCurrency(item.price)}", nil, nil
    )
    let withSuffix = try! EVYInterpreter.parseTextFromText(
        "{formatDimension(item.dimension.width)}", nil, nil
    )
    let WithSuffixAndRight = try! EVYInterpreter.parseTextFromText(
        "{formatDimension(item.dimension.width)} - {item.title}",
        nil, nil
    )
    let withComparison = try! EVYInterpreter.parseTextFromText(
        "{count(item.title) == count(selling_reasons)} v {count(item.title) == count(item.title)}",
        nil, nil
    )
    
    let weight = try! EVYInterpreter.parseTextFromText(
        "{formatWeight(item.dimension.weight)}", nil, nil
    )
    
    let firstSellingReason = try! EVY.getDataFromText("{selling_reasons[0]}")
    
    return VStack {
        Text("parseProps but no props: " + EVYInterpreter.parsePropsFromText(bare))
        Text("parseProps with props: " + EVYInterpreter.parsePropsFromText(data))
        Text(parsedData.toString())
        Text(withPrefix.toString())
        Text(withSuffix.toString())
        Text(WithSuffixAndRight.toString())
        Text(withComparison.toString())
        Text(weight.toString())
        Text(firstSellingReason.toString())
    }
}
