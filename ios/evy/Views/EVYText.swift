//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI
import SwiftData

struct EVYTextView: View {
    @State private var text: String
    let input: String
    
    init(_ input: String) {
        self.input = input
        _text = State(initialValue: "Loading...")
    }
    
    var body: some View {
        EVYText(text).onAppear {
            EVYParser.instance.parse(input) { value in
                text = value
            }
        }
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
    
    return Text(input)
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    EVYParser.instance.create(id: "item", data: item)
    
    return VStack {
        EVYTextView("::star.square.on.square.fill::")
        EVYTextView("Just text")
        EVYTextView("{item.title} ::star.square.on.square.fill:: and more text")
        EVYTextView("count: {count(item.photos)}")
        EVYTextView("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
    }
}
