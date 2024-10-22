//
//  EVYButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYButton: View {
    let label: String
    let action: () -> Void
    
    init(label: String, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            EVYTextView(label)
                .frame(maxWidth: .infinity)
                .foregroundColor(.white)
        }
        .padding(Constants.majorPadding)
        .frame(maxWidth: 150)
        .background(Constants.buttonColor)
        .cornerRadius(Constants.smallCornerRadius)
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    return VStack {
        EVYButton(label: "Button", action: {
            print("clicked button")
        })
        EVYButton(label: "Button", action: {
            print("clicked button")
        })
    }
}
