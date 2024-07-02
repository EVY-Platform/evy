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
    let value: String
    let action: () -> Void
    
    private let textColor: Color
    private let buttonFill: Color
    
    private let width: CGFloat = 70
    private let height: CGFloat = 40
    
    init(value: String, style: EVYInlineButtonStyle, action: @escaping () -> Void) {
        self.value = value
        self.action = action
        
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
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                    .fill(buttonFill)
                    .frame(height: height)
                    .frame(width: width)
                EVYTextView(value).foregroundColor(textColor)
            }
        }
    }
}


#Preview {
    VStack {
        EVYInlineButton(value: "test", style: .primary, action: { print("test") })
        EVYInlineButton(value: "test", style: .secondary, action: { print("test") })
        EVYInlineButton(value: "test", style: .clear, action: { print("test") })
    }
}

