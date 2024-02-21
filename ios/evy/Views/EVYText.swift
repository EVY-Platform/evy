//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

func EVYText(_ input: String) -> Text {
    if let match = firstIconMatch(input) {
        let matchIdx = match.range.location
        
        let matchUpperBound = match.range.upperBound
        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let range = Range(match.range(at: 1), in: input)
        let start = matchIdx > 0 ? EVYText(String(input[...matchStartIndex])) : Text("")
        let icon = Text("\(Image(systemName: String(input[range!])))")
        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
        
        return start + icon + end
    } else {
        return Text(parseEVYData(input))
    }
}

func firstIconMatch(_ input: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: "::([^::]*)::")
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
        EVYText("{count(item.photos)}")
    }
}
