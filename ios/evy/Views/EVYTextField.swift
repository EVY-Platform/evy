//
//  EVYTextField.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYTextField: View {
    @Binding var value: String
    let label: String
    let placeholder: String
    
    var body: some View {
        TextField(text: $value, prompt: EVYTextView.parsedText(placeholder), label: {
            EVYTextView(label)
        })
        .padding(EdgeInsets(top: Constants.majorPadding,
                            leading: Constants.minorPadding,
                            bottom: Constants.majorPadding,
                            trailing: Constants.minorPadding))
        .background(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
        )
    }
}

#Preview {
    return VStack {
        EVYTextField(value: .constant(""), label: "title", placeholder: "Sample placeholder")
        EVYTextField(value: .constant(""), label: "title", placeholder: "Sample ::star.square.on.square.fill:: placeholder")
        EVYTextField(value: .constant("Sample Text"), label: "title", placeholder: "Sample placeholder")
    }
}
