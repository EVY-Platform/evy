//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

func EVYText(_ input: String) -> Text {
    if let result = parseEVYFunction(input) {
        return EVYText(result)
    } else if let (match, data) = parseEVYData(input) {
        let matchIdx = match.range.location
        
        let matchUpperBound = match.range.upperBound
        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let start = matchIdx > 0 ? EVYText(String(input[...matchStartIndex])) : Text("")
        let middle = EVYText(data)
        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
        
        return start + middle + end
    } else if let (match, image) = parseEVYImage(input) {
        let matchIdx = match.range.location
        
        let matchUpperBound = match.range.upperBound
        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let start = matchIdx > 0 ? EVYText(String(input[...matchStartIndex])) : Text("")
        let middle = Text("\(image)")
        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
        
        return start + middle + end
    }
    
    return Text(input)
}

func parseEVYText(_ input: String) -> String {
    if let result = parseEVYFunction(input) {
        return parseEVYText(result)
    } else if let (match, data) = parseEVYData(input) {
        let matchIdx = match.range.location
        
        let matchUpperBound = match.range.upperBound
        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let start = matchIdx > 0 ? parseEVYText(String(input[...matchStartIndex])) : ""
        let middle = parseEVYText(data)
        let end = matchUpperBound < input.count ? parseEVYText(String(input[remainingIndex...])) : ""
        
        return start + middle + end
    }
    
    return input
}

#Preview {
    let data = EVYData.shared
    
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)
    
    return VStack {
        EVYText("::star.square.on.square.fill::")
        EVYText("Just text")
        EVYText("{item.title}")
        EVYText("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
    }
}
