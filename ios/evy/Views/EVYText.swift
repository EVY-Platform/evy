//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

let iconPattern = "::([^::]*)::"
let variablePattern = "\\{([^}]*)\\}"

func EVYText(_ input: String) -> Text {
    let data = EVYData.shared
    
    let iconMatch = firstIconMatch(input)
    let variableMatch = firstVariableMatch(input)
    
    let iconMatchIdx = iconMatch?.range.location ?? -1
    let variableMatchIdx = variableMatch?.range.location ?? -1
    
    let hasIconfirst = iconMatch != nil && (iconMatchIdx < variableMatchIdx || variableMatch == nil)
    let hasVariableFirst = variableMatch != nil && (variableMatchIdx < iconMatchIdx || iconMatch == nil)
    
    if (hasIconfirst) {
        let matchUpperBound = iconMatch!.range.upperBound
        let matchLowerBound = iconMatch!.range.lowerBound > 0 ? iconMatch!.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let range = Range(iconMatch!.range(at: 1), in: input)
        let start = iconMatchIdx > 0 ? Text(String(input[...matchStartIndex])) : Text("")
        let icon = Text("\(Image(systemName: String(input[range!])))")
        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
        
        return start + icon + end
    }
    
    if (hasVariableFirst) {
        let matchUpperBound = variableMatch!.range.upperBound
        let matchLowerBound = variableMatch!.range.lowerBound > 0 ? variableMatch!.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let range = Range(variableMatch!.range(at: 1), in: input)
        let start = variableMatchIdx > 0 ? Text(String(input[...matchStartIndex])) : Text("")
//        let variable = Text(try! data.parse(String(input[range!])))
        let variable = Text("variable")
        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
        
        return start + variable + end
    }
    
    return Text(input)
}

func firstIconMatch(_ input: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: iconPattern)
        if let match = regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)) {
            return match
        }
    } catch {}
    
    return nil
}

func firstVariableMatch(_ input: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: variablePattern)
        if let match = regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)) {
            return match
        }
    } catch {}
    
    return nil
}
    

#Preview {
    VStack {
        EVYText("::star.square.on.square.fill::")
        EVYText("Just text")
        EVYText("::star.square.on.square.fill:: 88% - ::star.square.on.square.fill:: 4 items sold")
        EVYText("{variable}")
        EVYText("{variable} ::star.square.on.square.fill::")
    }
}
