//
//  EVYTextField.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYTextField: View {
    let destination: String
    let placeholder: String
    let multiLine: Bool
    
    @State private var value: String
    
    init(value: String, destination: String, placeholder: String, multiLine: Bool) {
        self.placeholder = placeholder
        self.destination = destination
        self.multiLine = multiLine
        self.value = EVYTextView.parseText(value)
    }
    
    init(value: String, destination: String, placeholder: String) {
        self.init(value: value, destination: destination, placeholder: placeholder, multiLine: false)
    }
    
    var body: some View {
        TextField(text: $value,
                  prompt: EVYTextView.parsedText(placeholder),
                  axis: multiLine ? .vertical : .horizontal,
                  label: {})
        .lineLimit(multiLine ? 10... : 1...)
        .font(.evy)
        .padding(EdgeInsets(top: Constants.majorPadding,
                            leading: Constants.minorPadding,
                            bottom: Constants.majorPadding,
                            trailing: Constants.minorPadding))
        .overlay(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .stroke(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
        )
        .background(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
        )
        .onSubmit {
            try! EVYDataManager.i.updateValue(value, at: destination)
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(key: "item", data: item)
    
    return VStack {
        EVYTextField(value: "{item.title}",
                     destination: "{item.title}",
                     placeholder: "Sample placeholder")
                     
        EVYTextField(value: "{item.title}",
                     destination: "{item.title}",
                     placeholder: "Sample ::star.square.on.square.fill:: placeholder")
                     
        EVYTextField(value: "{item.title}",
                     destination: "{item.title}",
                     placeholder: "Sample placeholder", multiLine: true)
    }
}
