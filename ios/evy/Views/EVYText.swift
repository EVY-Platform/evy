//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYTextView: View {
    let text: String
    
    init(_ text: String) {
        self.text = EVYDataManager.i.parseText(text)
    }
    
    var body: some View {
        EVYText(text).lineSpacing(Constants.spacing)
    }
}

func EVYText(_ input: String) -> Text {
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
            return EVYText(start) + imageText + EVYText(end)
        } else if hasPrefix {
            let start = String(input.prefix(upTo: imageStart))
            return EVYText(start) + imageText
        } else if hasSuffix {
            let end = String(input.suffix(from: imageEnd))
            return imageText + EVYText(end)
        } else {
            return imageText
        }
    }
    
    return Text(EVYDataManager.i.parseText(input)).font(.evy)
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(item)
    
    return VStack {
        EVYTextView("::star.square.on.square.fill::")
        EVYTextView("Just text")
        EVYTextView("{item.title} ::star.square.on.square.fill:: and more text")
        EVYTextView("count: {count(item.photos)}")
        EVYTextView("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
    }
}
