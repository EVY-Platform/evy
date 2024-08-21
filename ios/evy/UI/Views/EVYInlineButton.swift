//
//  EVYInlineButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlineButton: View {
    let rectangle: EVYRectangle
    let action: () -> Void
    
    init(value: String, style: EVYRectangleStyle, action: @escaping () -> Void) {
        self.rectangle = EVYRectangle(value: value, style: style, width: .fixed)
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            rectangle
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

