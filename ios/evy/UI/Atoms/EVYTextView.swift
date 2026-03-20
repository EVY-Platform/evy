//
//  EVYTextView.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import LucideIcons
import SwiftUI
import UIKit

public enum EVYTextStyle: String {
    case body
    case title
    case info
    case button
    case action
}

struct EVYTextView: View {
	@Environment(\.colorScheme) var colorScheme

	private static let iconTokenRegex = try! Regex("::[a-zA-Z0-9-]+::")

	var text: EVYState<EVYValue>
    let style: EVYTextStyle
    
	init(_ text: String, placeholder: String = "", style: EVYTextStyle = .body) {
        self.style = style
		
		let props = EVY.parsePropsFromText(text)
		
		// If the props don't include any data and are just plain text
		// instanciate a simple version of state without any watching
		if props == text {
			self.text = EVYState(staticString: EVYValue(text, nil, nil))
			
		// Otherwise, go all out
		} else {
			let placeholderVal = EVYValue(placeholder, nil, nil)
			
			self.text = EVYState(watch: text, setter: {
				guard let value = try? EVY.getValueFromText($0) else {
					return placeholderVal
				}
				
				if props == $0 {
					return value
				}
				if $0.contains(value.value) {
					return placeholderVal
				}
				return value
			})
		}
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: .zero, content: {
            if let prefix = text.value.prefix {
                parsedText(prefix, style)
            }
            parsedText(text.value.value, style)
            if let suffix = text.value.suffix {
                parsedText(suffix, style)
            }
        })
    }
    
    func toText() -> Text {
        parsedText(toString(), style)
    }
    
    func toString() -> String {
        text.value.toString()
    }
	
	private func parsedText(_ input: String, _ style: EVYTextStyle = .body) -> Text {
		if input.count < 1 {
			return Text(input)
		}

		if let match = input.firstMatch(of: Self.iconTokenRegex) {
			let imageStart = match.range.lowerBound
			let imageEnd = match.range.upperBound

			let matchString = String(match.0)
			let imageName = matchString.trimmingCharacters(in: CharacterSet(charactersIn: ":"))
			let imageText: Text
			if let uiImage = UIImage(lucideId: imageName) {
				imageText = Text(Image(uiImage: uiImage).renderingMode(.template))
			} else {
				imageText = styledPlainText(matchString, style)
			}

			var result = imageText
			if imageStart > input.startIndex {
				let start = String(input.prefix(upTo: imageStart))
				result = parsedText(start, style) + result
			}
			if imageEnd < input.endIndex {
				let end = String(input.suffix(from: imageEnd))
				result = result + parsedText(end, style)
			}
			return result
		}
		
		return styledPlainText(input, style)
	}
	
	private func styledPlainText(_ input: String, _ style: EVYTextStyle) -> Text {
		switch style {
		case .title:
			return Text(input)
				.font(.evyTitle)
		case .info:
			return Text(input)
				.font(.evy)
				.foregroundStyle(Constants.textGreyColor)
		case .button:
			return Text(input)
				.font(.evy)
				.foregroundStyle(colorScheme == .light ? .white : .black)
		case .action:
			return Text(input)
				.font(.evy)
				.foregroundStyle(colorScheme == .light ? Constants.actionColor : .white)
		default:
			return Text(input).font(.evy)
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.createItem()
		return VStack {
			EVYTextView("::star::")
			EVYTextView("Body style", style: EVYTextStyle.body)
			EVYTextView("Info style", style: EVYTextStyle.info)
			EVYTextView("Title style", style: EVYTextStyle.title)
			EVYButton(label: "button", action: {})
			EVYTextView("Action", style: EVYTextStyle.action)
			EVYTextView("{item.title} ::star:: and more text")
			EVYTextView("count: {count(item.photo_ids)}")
			EVYTextView("{item.title} has {count(item.photo_ids)} photos ::star::")
		}
	}
}
