//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYValue {
    let value: String
    let prefix: String?
    let suffix: String?
    let props: (match: RegexMatch, props: String)?
    
    init(_ input: String) {
        self.props = parseProps(input)
        (self.value, self.prefix, self.suffix) = parseText(input, nil, nil)
    }
    
    func toString() -> String {
        return "\(prefix ?? "")\(value)\(suffix ?? "")"
    }
}

private func parseProps(_ input: String) -> (RegexMatch, String)? {
    if let match = firstMatch(input, pattern: "\\{(?!\")[^}^\"]*(?!\")\\}") {
        // Remove leading and trailing curly braces
        return (match, String(match.0.dropFirst().dropLast()))
    }
    return nil
}

private func parseText(_ input: String, _ prefix: String?, _ suffix: String?) -> EVYFunctionOutput {
    if (input.count < 1) {
        return (input, prefix, suffix)
    }
    if let (match, functionName, functionArgs) = parseFunctionFromText(input) {
        let returnPrefix = match.startIndex == 0
        let returnSuffix = match.range.upperBound.utf16Offset(in: input) == input.count
        
        var value: EVYFunctionOutput?
        
        switch functionName {
        case "count":
            value = evyCount(functionArgs)
        case "formatCurrency":
            value = evyFormatCurrency(functionArgs)
        case "formatDimension":
            value = evyFormatDimension(functionArgs)
        default:
            value = nil
        }
        
        if (value != nil) {
            let parsedInput = input.replacingOccurrences(
                of: match.0.description,
                with: "\(returnPrefix ? "" : value!.prefix ?? "")\(value!.value)"
            )
            return (
                parseText(parsedInput,
                          returnPrefix ? value!.prefix : prefix,
                          returnSuffix ? value!.suffix : suffix)
            )
        }
    }
    if let (match, props) = parseProps(input) {
        let data = try! EVYDataManager.i.parseProps(props)
        if let parsedData = data?.toString() {
            let parsedInput = input.replacingOccurrences(of: match.0.description, with: parsedData)
            return parseText(parsedInput, prefix, suffix)
        }
    }
    
    return (input, prefix, suffix)
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
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(key: "item", data: item)
    
    let bare = "test"
    let data = "{item.title}"
    let dataWithPrefix = "{formatCurrency(item.price)}"
    let dataWithSuffix = "{formatDimension(item.dimension.width)}"
    
    return VStack {
        Text(EVYValue(bare).value)
        Text(EVYValue(data).value)
        Text("\(EVYValue(dataWithPrefix).prefix!)\(EVYValue(dataWithPrefix).value)")
        Text("\(EVYValue(dataWithSuffix).value)\(EVYValue(dataWithSuffix).suffix!)")
    }
}
