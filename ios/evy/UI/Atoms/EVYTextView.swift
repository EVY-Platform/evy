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
    case info
    case button
    case action
}

struct EVYTextView: View {
    @ObservedObject var text: EVYState<EVYValue>
    let style: EVYTextStyle
    
	init(_ text: String, placeholder: String = "", style: EVYTextStyle = .body) {
        self.style = style
		
		let props = EVY.parsePropsFromText(text)
		let placeholderVal = EVYValue(placeholder, nil, nil)
        
        self.text = EVYState(watch: text, setter: {
			let value = EVY.getValueFromText($0)
			
			if props == $0 {
				return value
			}
			if $0.contains(value.value) {
				return placeholderVal
			}
			return value
        })
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: .zero, content: {
            if text.value.prefix != nil {
                parsedText(text.value.prefix!, style)
            }
            parsedText(text.value.value, style)
            if text.value.suffix != nil {
                parsedText(text.value.suffix!, style)
            }
        })
    }
    
    func toText() -> Text {
        return parsedText(self.toString(), style)
    }
    
    func toString() -> String {
        return text.value.toString()
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
        return Text(input)
            .font(.evyTitle)
    case .info:
        return Text(input)
            .font(.evy)
            .foregroundStyle(Constants.textColor)
    case .button:
        return Text(input)
            .font(.evyButton)
    case .action:
        return Text(input)
            .font(.evy)
            .foregroundStyle(Constants.actionColor)
    default:
        return Text(input).font(.evy)
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    return VStack {
        EVYTextView("::star.square.on.square.fill::")
        EVYTextView("Body style", style: EVYTextStyle.body)
        EVYTextView("Info style", style: EVYTextStyle.info)
        EVYTextView("Title style", style: EVYTextStyle.title)
        EVYTextView("Button", style: EVYTextStyle.button)
        EVYTextView("Action", style: EVYTextStyle.action)
        EVYTextView("{item.title} ::star.square.on.square.fill:: and more text")
        EVYTextView("count: {count(item.photo_ids)}")
        EVYTextView("{item.title} has {count(item.photo_ids)} photos ::star.square.on.square.fill::")
    }
}
