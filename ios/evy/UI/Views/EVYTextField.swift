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
    
    @ObservedObject private var i: EVYState<EVYValue>
    
    @State private var value: String
    
    @FocusState private var focused: Bool
    @State private var editing: Bool = false
    
    init(input: String, destination: String, placeholder: String, multiLine: Bool) {
        let i = EVYState(watch: input, setter: EVY.getValueFromText)
        
        self.placeholder = placeholder
        self.destination = destination
        self.multiLine = multiLine
        
        self.i = i
        self.value = i.value.value
    }
    
    init(input: String, destination: String, placeholder: String) {
        self.init(input: input,
                  destination: destination,
                  placeholder: placeholder,
                  multiLine: false)
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: .zero, content: {
            if (!editing) {
                Group {
                    if i.value.value.count > 0 {
                        EVYTextView(i.value.prefix ?? "")
                        EVYTextView(i.value.value)
                        EVYTextView(i.value.suffix ?? "")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        EVYTextView(placeholder, style: .info)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.bottom, 1)
                .padding(.top, 1)
            } else {
                let valueBinding = Binding(
                    get: { i.value.value },
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
        })
        .font(.evy)
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
                     destination: "{item.price}",
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
