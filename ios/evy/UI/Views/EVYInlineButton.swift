//
//  EVYInlineButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

public enum EVYInlineButtonStyle: String {
    case primary
    case secondary
    case clear
}
    
struct EVYInlineButton: View {
    var value: String
    
    private var textColor: Color
    private var buttonFill: Color
    
    private let width: CGFloat = 70
    private let height: CGFloat = 40
    private let radius: CGFloat = 10
    
    init(value: String, style: EVYInlineButtonStyle) {
        self.value = value
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
    
    var body: some View {
        ZStack() {
            RoundedRectangle(cornerRadius: radius)
                .fill(buttonFill)
                .frame(height: height)
            EVYTextView(value)
                .foregroundColor(textColor)
        }.frame(width: width)
    }
}


#Preview {
    VStack {
        EVYInlineButton(value: "test", style: .primary)
        EVYInlineButton(value: "test", style: .secondary)
        EVYInlineButton(value: "test", style: .clear)
    }
}

