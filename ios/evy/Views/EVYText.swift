//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

let iconPattern = "::([^::]*)::"
let dataPattern = "\\{([^}]*)\\}"

func EVYText(_ input: String) -> Text {
    let iconMatch = firstIconMatch(input)
    let dataMatch = firstDataMatch(input)
    
    let iconMatchIdx = iconMatch?.range.location ?? -1
    let dataMatchIdx = dataMatch?.range.location ?? -1
    
    let hasIconfirst = iconMatch != nil && (iconMatchIdx < dataMatchIdx || dataMatch == nil)
    let hasDataFirst = dataMatch != nil && (dataMatchIdx < iconMatchIdx || iconMatch == nil)
    
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
    
    if (hasDataFirst) {
        let matchUpperBound = dataMatch!.range.upperBound
        let matchLowerBound = dataMatch!.range.lowerBound > 0 ? dataMatch!.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let range = Range(dataMatch!.range(at: 1), in: input)
        let start = dataMatchIdx > 0 ? Text(String(input[...matchStartIndex])) : Text("")
        let data = Text("{variable}")
        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
        
        return start + data + end
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

func firstDataMatch(_ input: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: dataPattern)
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
