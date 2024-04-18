//
//  EVYText.swift
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

public enum EVYTextStyle: String {
    case body
    case title
}

struct EVYTextView: View {
    let text: String
    var style: EVYTextStyle = .body
    
    init(_ text: String, style: EVYTextStyle = .body) {
        self.text = EVYTextView.parseText(text)
        self.style = style
    }
    
    var body: some View {
        EVYTextView.parsedText(text, style).lineSpacing(Constants.spacing)
    }
    
    static func propsFromText(_ input: String) -> (RegexMatch, String)? {
        if let match = firstMatch(input, pattern: propsPattern) {
            // Remove leading and trailing curly braces
            return (match, String(match.0.dropFirst().dropLast()))
        }
        return nil
    }
    
    static func parsedText(_ input: String, _ style: EVYTextStyle = .body) -> Text {
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
                return self.parsedText(start, style) + imageText + self.parsedText(end, style)
            } else if hasPrefix {
                let start = String(input.prefix(upTo: imageStart))
                return self.parsedText(start, style) + imageText
            } else if hasSuffix {
                let end = String(input.suffix(from: imageEnd))
                return imageText + self.parsedText(end, style)
            } else {
                return imageText
            }
        }
        
        switch style {
        case .title:
            return Text(parseText(input)).font(.evyTitle)
        default:
            return Text(parseText(input)).font(.evy)
        }
    }
    
    static func parseText(_ input: String) -> String {
        if (input.count < 1) {
            return input
        }
        else if let (match, comparisonOperator, left, right) = parseComparisonFromText(input) {
            let leftData = try! EVYDataManager.i.parseProps(left)
            let parsedLeft = leftData?.toString() ?? left
            
            let rightData = try! EVYDataManager.i.parseProps(right)
            let parsedRight = rightData?.toString() ?? right
            
            let comparisonResult = evyComparison(comparisonOperator,
                                                 left: parseText(parsedLeft),
                                                 right: parseText(parsedRight))
            let parsedInput = input.replacingOccurrences(of: match.0.description,
                                                         with: comparisonResult ? "true" : "false")
            return parseText(parsedInput)
        } else if let (match, functionName, functionArgs) = parseFunctionFromText(input) {
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
            else if functionName == "formatDimension" {
                let dimension = evyFormatDimension(functionArgs)
                let parsedInput = input.replacingOccurrences(of: match.0.description, with: dimension)
                return parseText(parsedInput)
            }
        } else if let (match, functionName, functionArgs) = parseFunctionInText(input) {
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
            else if functionName == "formatDimension" {
                let dimension = evyFormatDimension(functionArgs)
                let parsedInput = input.replacingOccurrences(of: match.0.description, with: dimension)
                return parseText(parsedInput)
            }
        } else if let (match, props) = EVYTextView.propsFromText(input) {
            let data = try! EVYDataManager.i.parseProps(props)
            if let parsedData = data?.toString() {
                let parsedInput = input.replacingOccurrences(of: match.0.description, with: parsedData)
                return parseText(parsedInput)
            }
        }
        
        return input
    }
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
    
    guard let (subMatch, functionName, functionArgs) = parseFunctionInText(input) else {
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
    return VStack {
        EVYTextView("::star.square.on.square.fill::")
        EVYTextView("Just text", style: EVYTextStyle.title)
        EVYTextView("{item.title} ::star.square.on.square.fill:: and more text")
        EVYTextView("count: {count(item.photos)}")
        EVYTextView("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
        EVYTextView("{a == b}")
    }
}
