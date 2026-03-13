//
//  EVYInterpreter.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

private let comparisonBlockPattern = "\\{[^{}\"]+\\}"
private let comparisonOperatorPattern = "(>=|<=|==|!=|>|<)"
private let comparisonOperators = [">=", "<=", "==", "!=", ">", "<"]
private let propsPattern = "\\{(?!\")[^}^\"]*(?!\")\\}"
private let functionParamsPattern = "\\(([^)]*)\\)"
private let functionPattern = "[a-zA-Z_]+\(functionParamsPattern)"
private let arrayPattern = "\\[([\\d]*)\\]"
public let PROP_SEPARATOR = "."

@MainActor
struct EVYInterpreter {
    /**
     * Takes a string from the SDUI API
     * - extracts the 1st instance of props from it, stripping out brackets
     * - returns that props string
     */
    public static func parsePropsFromText(_ input: String) -> String {
        guard let match = try? firstMatch(input, pattern: propsPattern) else {
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
        
        var splitProps = props.components(separatedBy: PROP_SEPARATOR)
        if splitProps.count < 1 {
            throw EVYParamError.invalidProps
        }
        for i in splitProps.indices {
            if let matchArray = try? firstMatch(splitProps[i],
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
                                         _ editing: Bool = false) throws -> EVYValue
    {
        try parseText(EVYValue(input, nil, nil), editing)
    }

    public static func parseFunctionCall(_ input: String) -> (functionName: String, functionArgs: String)? {
        let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if let (_, functionName, functionArgs) = parseFunctionInText(trimmedInput) {
            return (functionName, functionArgs)
        }
        return nil
    }
    
    private static func parseText(_ input: EVYValue,
                                  _ editing: Bool) throws -> EVYValue
    {
        if input.value.isEmpty {
            return input
        }
        
        if let (fullMatch, comparison) = parseComparisonFromText(input.value)
        {
            let comparisonResult = try evaluateBooleanExpression(comparison) { operand in
                let trimmedOperand = operand.trimmingCharacters(in: .whitespacesAndNewlines)
                let parsedOperand = try parseText(EVYValue(trimmedOperand, nil, nil),
                                                  editing)
                if parsedOperand.value != trimmedOperand {
                    return parsedOperand.value
                }
                if let propsValue = try? EVY.getDataFromText("{\(trimmedOperand)}") {
                    return propsValue.toString()
                }
                return parsedOperand.value
            }
            let parsedInput = input.value.replacingOccurrences(
                of: fullMatch,
                with: comparisonResult ? "true" : "false"
            )
            return try parseText(EVYValue(parsedInput, input.prefix, input.suffix),
                                 editing)
        }
 
        if let (match, funcName, funcArgs) =
            parseFunctionFromText(input.value)
            ?? parseFunctionInText(input.value)
        {
            let returnPrefix = match.startIndex == 0
            let upperBound = match.range.upperBound.utf16Offset(in: input.value)
            let returnSuffix = upperBound == input.value.count
            
            let value: EVYFunctionOutput?
            
            switch funcName {
            case "count":
                value = try evyCount(funcArgs)
            case "length":
                value = try evyLength(funcArgs)
            case "formatCurrency":
                value = try evyFormatCurrency(funcArgs, editing)
            case "formatDimension":
                value = try evyFormatDimension(funcArgs, editing)
            case "formatWeight":
                value = try evyFormatWeight(funcArgs, editing)
            case "formatAddress":
                value = try evyFormatAddress(funcArgs)
            case "buildCurrency", "buildAddress":
                value = nil
            default:
                value = nil
            }
            
            if let value = value {
                let returnValuesToJoin = [
                    returnPrefix ? "" : value.prefix ?? "",
                    value.value,
                    returnSuffix ? "" : value.suffix ?? ""
                ]
                let parsedInput = input.value.replacingOccurrences(
                    of: match.0.description,
                    with: returnValuesToJoin.joined()
                )
                return try parseText(EVYValue(parsedInput,
                                              returnPrefix ? value.prefix : input.prefix,
                                              returnSuffix ? value.suffix : input.suffix),
                                     editing)
            }
        }
        
        if let (match, props) = parseProps(input.value) {
            let data = try EVY.getDataFromProps(props)
            let parsedInput = input.value.replacingOccurrences(of: match.0.description,
                                                               with: data.toString())
            return try parseText(EVYValue(parsedInput, input.prefix, input.suffix),
                                 editing)
        }
        
        return input
    }
}

private func parseProps(_ input: String) -> (Regex<AnyRegexOutput>.Match, String)? {
    if let match = try? firstMatch(input, pattern: propsPattern) {
        // Remove leading and trailing curly braces
        return (match, String(match.0.dropFirst().dropLast()))
    }
    return nil
}

private func parseArrayFromProps(_ input: String) -> (Regex<AnyRegexOutput>.Match, String)? {
    if let match = try? firstMatch(input, pattern: arrayPattern) {
        // Remove leading and trailing curly braces
        return (match, String(match.0))
    }
    return nil
}

private func parseComparisonFromText(_ input: String) -> (fullMatch: String, content: String)?
{
    guard let regex = try? Regex(comparisonBlockPattern) else {
        return nil
    }
    for match in input.matches(of: regex) {
        let block = String(match.0)
        let comparison = String(block.dropFirst().dropLast())
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if containsTopLevelComparisonOperator(comparison) {
            return (block, comparison)
        }
    }
    return nil
}

private func evaluateBooleanExpression(_ input: String,
                                       resolver: (String) throws -> String) throws -> Bool
{
    let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
    let orTerms = splitRespectingParens(trimmedInput, separator: "||")
    if orTerms.count > 1 {
        for term in orTerms {
            if try evaluateBooleanExpression(term, resolver: resolver) {
                return true
            }
        }
        return false
    }

    let andTerms = splitRespectingParens(trimmedInput, separator: "&&")
    if andTerms.count > 1 {
        for term in andTerms {
            if try !evaluateBooleanExpression(term, resolver: resolver) {
                return false
            }
        }
        return true
    }

    if isWrappedInParentheses(trimmedInput) {
        let innerExpression = String(trimmedInput.dropFirst().dropLast())
        return try evaluateBooleanExpression(innerExpression, resolver: resolver)
    }

    if trimmedInput == "true" {
        return true
    }
    if trimmedInput == "false" {
        return false
    }

    guard let (left, comparisonOperator, right) = parseAtomicComparison(trimmedInput) else {
        throw EVYError.invalidData(context: "Invalid comparison expression: \(trimmedInput)")
    }

    let resolvedLeft = try resolver(left)
    let resolvedRight = try resolver(right)
    return evyComparison(comparisonOperator, left: resolvedLeft, right: resolvedRight)
}

private func splitRespectingParens(_ input: String, separator: String) -> [String] {
    guard !input.isEmpty else {
        return [input]
    }

    var parts: [String] = []
    var depth = 0
    var currentStart = input.startIndex
    var index = input.startIndex

    while index < input.endIndex {
        let character = input[index]
        if character == "(" {
            depth += 1
        } else if character == ")" && depth > 0 {
            depth -= 1
        }

        if depth == 0, input[index...].hasPrefix(separator) {
            parts.append(String(input[currentStart..<index])
                .trimmingCharacters(in: .whitespacesAndNewlines))
            currentStart = input.index(index, offsetBy: separator.count)
            index = currentStart
            continue
        }

        index = input.index(after: index)
    }

    parts.append(String(input[currentStart...]).trimmingCharacters(in: .whitespacesAndNewlines))
    return parts
}

private func parseAtomicComparison(_ input: String) -> (left: String,
                                                        comparisonOperator: String,
                                                        right: String)?
{
    var depth = 0
    var index = input.startIndex

    while index < input.endIndex {
        let character = input[index]
        if character == "(" {
            depth += 1
        } else if character == ")" && depth > 0 {
            depth -= 1
        }

        if depth == 0 {
            for comparisonOperator in comparisonOperators {
                if input[index...].hasPrefix(comparisonOperator) {
                    let left = String(input[..<index]).trimmingCharacters(in: .whitespacesAndNewlines)
                    let rightStart = input.index(index, offsetBy: comparisonOperator.count)
                    let right = String(input[rightStart...]).trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !left.isEmpty, !right.isEmpty else {
                        return nil
                    }
                    return (left, comparisonOperator, right)
                }
            }
        }

        index = input.index(after: index)
    }

    return nil
}

private func containsTopLevelComparisonOperator(_ input: String) -> Bool {
    var depth = 0
    var index = input.startIndex

    while index < input.endIndex {
        let character = input[index]
        if character == "(" {
            depth += 1
        } else if character == ")" && depth > 0 {
            depth -= 1
        }

        if depth == 0 {
            for comparisonOperator in comparisonOperators {
                if input[index...].hasPrefix(comparisonOperator) {
                    return true
                }
            }
        }

        index = input.index(after: index)
    }

    return false
}

private func isWrappedInParentheses(_ input: String) -> Bool {
    guard input.first == "(", input.last == ")" else {
        return false
    }

    var depth = 0
    for index in input.indices {
        let character = input[index]
        if character == "(" {
            depth += 1
        } else if character == ")" {
            depth -= 1
            if depth == 0 {
                return index == input.index(before: input.endIndex)
            }
        }
    }

    return false
}

private func parseFunctionFromText(_ input: String) -> (match: Regex<AnyRegexOutput>.Match,
                                                        functionName: String,
                                                        functionArgs: String)?
{
    guard let match = try? firstMatch(input, pattern: "\\{\(functionPattern)\\}") else {
        return nil
    }

    guard let (_, functionName, functionArgs) = parseFunctionInText(input) else {
        return nil
    }

    return (match, functionName, functionArgs)
}

private func parseFunctionInText(_ input: String) -> (match: Regex<AnyRegexOutput>.Match,
                                                      functionName: String,
                                                      functionArgs: String)?
{
    guard let match = try? firstMatch(input, pattern: functionPattern) else {
        return nil
    }
    
    // Remove opening { from match
    let functionCall = match.0.description
    guard let argsAndParenthesisMatch = try? firstMatch(functionCall,
                                                        pattern: functionParamsPattern) else
    {
        return nil
    }
    
    let parenthesisStartIndex = argsAndParenthesisMatch.range.lowerBound
    let functionNameEndIndex = functionCall.index(before: parenthesisStartIndex)
    let functionName = functionCall[functionCall.startIndex...functionNameEndIndex]
    
    let argsAndParenthesis = argsAndParenthesisMatch.0.description
    let functionArgs = argsAndParenthesis.dropFirst().dropLast()

    return (match, String(functionName), String(functionArgs))
}

private func firstMatch(_ input: String, pattern: String) throws -> Regex<AnyRegexOutput>.Match? {
    let regex = try Regex(pattern)
    return input.firstMatch(of: regex)
}

private func lastMatch(_ input: String, pattern: String) throws -> Regex<AnyRegexOutput>.Match? {
    let regex = try Regex(pattern)
    return input.matches(of: regex).last
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! EVY.getUserData()
		try! await EVY.createItem()
		
	let bare = "test"
	let data = "{title}"
	
	let parsedData = try! EVYInterpreter.parseTextFromText(data)
	let withPrefix = try! EVYInterpreter.parseTextFromText(
		"{formatCurrency(price)}"
	)
	let withSuffix = try! EVYInterpreter.parseTextFromText(
		"{formatDimension(width)}"
	)
	let WithSuffixAndRight = try! EVYInterpreter.parseTextFromText(
		"{formatDimension(width)} - {title}"
	)
	let withComparison = try! EVYInterpreter.parseTextFromText(
		"{count(title) == count(selling_reasons)} v {count(title) == count(title)}"
	)
    let withMultiComparison = try! EVYInterpreter.parseTextFromText(
        "{count(title) > 0 || (1 > 2 && count(selling_reasons) > 0)}"
    )
	
	let weight = try! EVYInterpreter.parseTextFromText(
		"{formatWeight(weight)}"
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
            Text(withMultiComparison.toString())
			Text(weight.toString())
			Text(firstSellingReason.toString())
			
		EVYTextField(input: "{formatCurrency(price)}",
					 destination: "{price}",
					 placeholder: "Editing price")
		}
	}
}
