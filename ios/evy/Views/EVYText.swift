//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI
import SwiftData

func EVYText(_ input: String) -> Text {
//    if let result = EVYParser.instance.parseFunction(input) {
//        return EVYText(result)
//    } else if let (match, data) = EVYParser.instance.parseData(input) {
//        let matchIdx = match.range.location
//        
//        let matchUpperBound = match.range.upperBound
//        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
//        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
//        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
//        
//        let start = matchIdx > 0 ? EVYText(String(input[...matchStartIndex])) : Text("")
//        let middle = EVYText(data)
//        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
//        
//        return start + middle + end
//    } else if let (match, image) = EVYParser.instance.parseImage(input) {
//        let matchIdx = match.range.location
//        
//        let matchUpperBound = match.range.upperBound
//        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
//        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
//        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
//        
//        let start = matchIdx > 0 ? EVYText(String(input[...matchStartIndex])) : Text("")
//        let middle = Text("\(image)")
//        let end = matchUpperBound < input.count ? EVYText(String(input[remainingIndex...])) : Text("")
//        
//        return start + middle + end
//    }
    
    return Text(input)
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: EVYData.self, configurations: config)
    
    let item = DataConstants.item.data(using: .utf8)!
    container.mainContext.insert(EVYData(id: "item", data: item))
    
    return VStack {
        EVYText("::star.square.on.square.fill::")
        EVYText("Just text")
        EVYText("{item.title}")
        EVYText("{count(item.photos)}")
        EVYText("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
    }.modelContainer(container)
}
