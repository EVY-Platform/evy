//
//  EVYText.swift
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
        TextField(text: $value, prompt: Text(placeholder), label: {
            Text(label)
        })
        .padding(EdgeInsets(top: Constants.majorPadding,
                            leading: Constants.minorPadding,
                            bottom: Constants.majorPadding,
                            trailing: Constants.minorPadding))
        .background(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .strokeBorder(Constants.fieldBorderColor, lineWidth: 1)
        )
    }
}

#Preview {
    EVYTextField(value: .constant("Sample Text"), label: "title", placeholder: "Item title")
}
