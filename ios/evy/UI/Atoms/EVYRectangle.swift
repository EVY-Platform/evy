//
//  EVYRectangle.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

public enum EVYRectangleStyle: String {
    case primary
    case secondary
    case clear
}

public enum EVYRectangleWidth: String {
    case fixed
    case fit
}

struct EVYRectangle: View {
    let content: any View
    let width: CGFloat?
    
    private let height: CGFloat = 40
    private let textColor: Color
    private let buttonFill: Color
    
    private init(content: any View, style: EVYRectangleStyle, width: CGFloat?) {
        self.content = content
        self.width = width
        
        switch style {
        case .primary:
            textColor = .white
            buttonFill = Constants.buttonColor
        case .secondary:
            textColor = .black
            buttonFill = Constants.inactiveBackground
        default:
            textColor = .black
            buttonFill = .clear
        }
    }
    
    static func fixedWidth(content: any View, style: EVYRectangleStyle, width: CGFloat) -> EVYRectangle {
        return EVYRectangle.init(content: content, style: style, width: width)
    }
    
    static func fitWidth(content: any View, style: EVYRectangleStyle) -> EVYRectangle {
        return EVYRectangle.init(content: content, style: style, width: nil)
    }
    
    var body: some View {
        AnyView(content)
            .foregroundColor(textColor)
            .padding(Constants.majorPadding)
            .frame(width: width, height: height)
            .background(content: {
                RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                    .fill(buttonFill)
            })
    }
}


#Preview {
    VStack {
        EVYRectangle.fixedWidth(content: EVYTextView("test"), style: .primary, width: 60)
        EVYRectangle.fixedWidth(content: EVYTextView("test"), style: .secondary, width: 60)
        EVYRectangle.fixedWidth(content: EVYTextView("test"), style: .clear, width: 60)
        EVYRectangle.fitWidth(content: EVYTextView("looooooooong"), style: .primary)
        EVYRectangle.fixedWidth(content: EVYTextView("toooo looong"), style: .primary, width: 70)
    }
}

