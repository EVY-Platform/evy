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
    let input: String
    
    @ObservedObject private var editableValue: EVYState<EVYValue>
    
    @State private var value: String
    
    @FocusState private var focused: Bool
    @State private var editing: Bool = false
    
    init(input: String, destination: String, placeholder: String, multiLine: Bool) {
        self.input = input
        self.placeholder = placeholder
        self.destination = destination
        self.multiLine = multiLine
        
        let editableValue = EVYState(watch: input, setter: {
            EVY.getValueFromText($0, editing: true)
        })
        self.editableValue = editableValue
        self.value = editableValue.value.value
    }
    
    init(input: String, destination: String, placeholder: String) {
        self.init(input: input,
                  destination: destination,
                  placeholder: placeholder,
                  multiLine: false)
    }
    
    var body: some View {
        Group {
            if (!editing || destination.isEmpty) {
                let display = EVYTextView(input)
                let placeholder = EVYTextView(placeholder, style: .info)
                
                if (display.text.value.value.count > 0) {
                    display.frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    placeholder.frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                let valueBinding = Binding(
                    get: { editableValue.value.value },
                    set: { value = $0 }
                )
                TextField(text: valueBinding,
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
                .onChange(of: value, { oldValue, newValue in
                    try! EVY.updateValue(newValue, at: destination)
                })
                .onSubmit {
                    editing = false
                    focused = false
                }
            }
        }
        .padding(EdgeInsets(top: Constants.fieldPadding,
                            leading: Constants.minorPadding,
                            bottom: Constants.fieldPadding,
                            trailing: Constants.minorPadding))
        .background(
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
                .opacity(Constants.fieldBorderOpacity)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            editing.toggle()
            focused.toggle()
        }
        
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    return VStack {
        EVYTextField(input: "{formatDimension(item.dimension.width)}",
                     destination: "{item.dimension.width}",
                     placeholder: "10",
                     multiLine: true)
        
        EVYTextField(input: "{formatCurrency(item.price)}",
                     destination: "{item.price.value}",
                     placeholder: "10")
                     
        EVYTextField(input: "{item.title}",
                     destination: "{item.title}",
                     placeholder: "Sample placeholder",
                     multiLine: true)
        
        EVYTextField(input: "{item.title}",
                     destination: "{item.title}",
                     placeholder: "Sample placeholder")
        
        EVYTextField(input: "",
                     destination: "",
                     placeholder: "Sample placeholder")
    }
}
