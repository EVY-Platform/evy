//
//  EVYText.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

public enum EVYTextStyle: String {
    case body
    case title
}

struct EVYTextView: View {
    let text: EVYValue
    var style: EVYTextStyle = .body
    
    init(_ text: String, style: EVYTextStyle = .body) {
        self.text = EVYValue(text)
        self.style = style
    }
    
    var body: some View {
        parsedText(text.value, style).lineSpacing(Constants.spacing)
    }
    
    func toText() -> Text {
        return parsedText(self.toString(), style)
    }
    
    func toString() -> String {
        return text.toString()
    }
}

private func parsedText(_ input: String, _ style: EVYTextStyle = .body) -> Text {
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
            return parsedText(start, style) + imageText + parsedText(end, style)
        } else if hasPrefix {
            let start = String(input.prefix(upTo: imageStart))
            return parsedText(start, style) + imageText
        } else if hasSuffix {
            let end = String(input.suffix(from: imageEnd))
            return imageText + parsedText(end, style)
        } else {
            return imageText
        }
    }
    
    switch style {
    case .title:
        return Text(input).font(.evyTitle)
    default:
        return Text(input).font(.evy)
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(key: "item", data: item)
    
    return VStack {
        EVYTextView("::star.square.on.square.fill::")
        EVYTextView("Just text", style: EVYTextStyle.title)
        EVYTextView("{item.title} ::star.square.on.square.fill:: and more text")
        EVYTextView("count: {count(item.photos)}")
        EVYTextView("{item.title} has {count(item.photos)} photos ::star.square.on.square.fill::")
    }
}
