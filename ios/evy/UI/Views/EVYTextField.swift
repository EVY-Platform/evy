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
    
    @State private var input: String
    
    @State private var value: String
    @State private var prefix: String
    @State private var suffix: String
    
    @FocusState private var focused: Bool
    @State private var editing: Bool = false
    
    init(input: String, destination: String, placeholder: String, multiLine: Bool) {
        self.placeholder = placeholder
        self.destination = destination
        self.multiLine = multiLine
        
        self.input = input
        
        (self.value, self.prefix, self.suffix) = resetValues(input)
    }
    
    init(input: String, destination: String, placeholder: String) {
        self.init(input: input, destination: destination, placeholder: placeholder, multiLine: false)
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: .zero, content: {
            let showPrefix = !multiLine && prefix.count > 0
            let showSuffix = !multiLine && suffix.count > 0
            if (!editing) {
                Group {
                    if (showPrefix) {
                        Text(prefix)
                    }
                    Text(value)
                        .frame(maxWidth: showSuffix ? nil : .infinity, alignment: .leading)
                    if (showSuffix) {
                        Text(suffix)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }.onTapGesture {
                    editing = true
                    focused = true
                }
                .padding(.bottom, 1)
                .padding(.top, 1)
            } else {
                TextField(text: $value,
                          prompt: EVYTextView(placeholder).toText(),
                          axis: multiLine ? .vertical : .horizontal,
                          label: {})
                .lineLimit(multiLine ? 10... : 1...)
                .focused($focused)
                .onChange(of: focused, { oldValue, newValue in
                    if (oldValue == true && newValue == false) {
                        editing = false
                    }
                })
                .onSubmit {
                    try! EVY.updateValue(value, at: destination)
                    (self.value, self.prefix, self.suffix) = resetValues(self.input)
                    editing = false
                    focused = false
                }
            }
        })
        .font(.evy)
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

private func resetValues(_ input: String)-> (value: String, prefix: String, suffix: String) {
    let parsedInput = EVY.parseText(input)
    return (parsedInput.value, parsedInput.prefix ?? "", parsedInput.suffix ?? "")
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    return VStack {
        EVYTextField(input: "{formatDimension(item.dimension.width)}",
                     destination: "{item.dimension.width}",
                     placeholder: "10")
        
        EVYTextField(input: "{formatCurrency(item.price)}",
                     destination: "{item.price}",
                     placeholder: "10")
                     
        EVYTextField(input: "{item.title}",
                     destination: "{item.title}",
                     placeholder: "Sample placeholder", multiLine: true)
    }
}
