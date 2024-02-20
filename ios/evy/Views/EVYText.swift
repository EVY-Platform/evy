//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

let iconPattern = "::([^::]*)::"
let variablePattern = "\\{([^}]*)\\}"

extension String {
    var evyText: String {
        let data = EVYData.shared
        
        let variableMatch = firstVariableMatch(self)
        let variableMatchIdx = variableMatch?.range.location ?? -1
        
        if (variableMatch == nil) {
            return self
        }
            
        let matchUpperBound = variableMatch!.range.upperBound
        let matchLowerBound = variableMatch!.range.lowerBound > 0 ? variableMatch!.range.lowerBound-1 : 0
        let matchStartIndex = self.index(self.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = self.index(self.startIndex, offsetBy: matchUpperBound)
        
        let range = Range(variableMatch!.range(at: 1), in: self)
        var variable = String(self[range!])
        do {
            variable = try data.parse(variable)
        } catch {}
        
        let start = variableMatchIdx > 0 ? String(self[...matchStartIndex]) : ""
        let end = matchUpperBound < self.count ? String(self[remainingIndex...]) : ""
        
        return start + variable + end
    }
}

func EVYText(_ input: String) -> Text {
    let iconMatch = firstIconMatch(input)
    let iconMatchIdx = iconMatch?.range.location ?? -1
    
    if (iconMatch == nil) {
        return Text(input.evyText)
    }
    
    let matchUpperBound = iconMatch!.range.upperBound
    let matchLowerBound = iconMatch!.range.lowerBound > 0 ? iconMatch!.range.lowerBound-1 : 0
    let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
    let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
    
    let range = Range(iconMatch!.range(at: 1), in: input)
    let start = iconMatchIdx > 0 ? EVYText(String(input[...matchStartIndex])) : Text("")
    let icon = Text("\(Image(systemName: String(input[range!])))")
    let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
    
    return start + icon + end
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
    let data = EVYData.shared
    
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)
    
    return VStack {
        EVYText("::star.square.on.square.fill::")
        EVYText("Just text")
        EVYText("::star.square.on.square.fill:: 88% - {item.title} 4 items sold")
        EVYText("{item.title}")
        EVYText("{item.title} ::star.square.on.square.fill::")
        Text("{item.title}".evyText)
    }
}
