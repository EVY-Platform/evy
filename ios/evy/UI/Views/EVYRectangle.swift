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
    let value: String
    
    private let textColor: Color
    private let buttonFill: Color
    
    private let width: CGFloat = 70
    private let height: CGFloat = 40
    
    private let fixedWidth: Bool
    
    init(value: String, style: EVYRectangleStyle, width: EVYRectangleWidth) {
        self.value = value
        self.fixedWidth = width == .fixed
        
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
        ZStack {
            EVYTextView(value)
                .padding(Constants.majorPadding)
                .frame(height: height)
                .frame(width: fixedWidth ? width : nil)
                .overlay(content: {
                    RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                        .fill(buttonFill)
                })
            EVYTextView(value).foregroundColor(textColor)
        }
    }
}


#Preview {
    VStack {
        EVYRectangle(value: "test", style: .primary, width: .fixed)
        EVYRectangle(value: "test", style: .secondary, width: .fixed)
        EVYRectangle(value: "test", style: .clear, width: .fixed)
        EVYRectangle(value: "looooooooong", style: .primary, width: .fit)
    }
}

