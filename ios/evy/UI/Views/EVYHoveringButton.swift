//
//  EVYHoveringButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 10/7/2024.
//

import SwiftUI

struct EVYHoveringButton: View {
    let action: () -> Void
    let icon: String

    var body: some View {
        Button(action: action) {
            Circle()
                .fill(.white)
                .strokeBorder(Constants.fieldBorderColor,
                              lineWidth: Constants.borderWidth)
                .overlay(EVYTextView("::\(icon)::", style: .button))
        }
        .frame(height: 40)
        .frame(width: 40)
        .padding()
    }
}

#Preview {
    EVYHoveringButton(action: { print("test" )}, icon: "star")
}
