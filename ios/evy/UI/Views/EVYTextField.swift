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
    
    @Bindable private var displayValue: EVYState<EVYValue>
    @Bindable private var editableValue: EVYState<EVYValue>
    @Bindable private var placeholderValue: EVYState<EVYValue>
    
    @FocusState private var focused: Bool
    @State private var editing: Bool = false
    
    init(input: String, destination: String, placeholder: String, multiLine: Bool) {
        self.input = input
        self.placeholder = placeholder
        self.destination = destination
        self.multiLine = multiLine
        
        self.displayValue = EVYState(watch: input, setter: {
            Self.resolveValue(from: $0)
        })
        self.editableValue = EVYState(watch: input, setter: {
            Self.resolveValue(from: $0, editing: true)
        })
        self.placeholderValue = EVYState(watch: placeholder, setter: {
            Self.resolveValue(from: $0)
        })
    }
    
    init(input: String, destination: String, placeholder: String) {
        self.init(input: input,
                  destination: destination,
                  placeholder: placeholder,
                  multiLine: false)
    }
    
    private static func resolveValue(from text: String, editing: Bool = false) -> EVYValue {
        if let resolvedValue = try? EVY.getValueFromText(text, editing: editing) {
            return resolvedValue
        }
        if EVY.parsePropsFromText(text) == text {
            return EVYValue(text, nil, nil)
        }
        return EVYValue("", nil, nil)
    }
    
    var body: some View {
        Group {
            if !editing || destination.isEmpty {
                let display = EVYTextView(displayValue.value.toString())
                let placeholder = EVYTextView(placeholderValue.value.toString(), style: .info)
                
                if display.text.value.value.count > 0 {
                    display.frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    placeholder.frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                TextField(text: $editableValue.value.value,
                          prompt: EVYTextView(placeholderValue.value.toString()).toText(),
                          axis: multiLine ? .vertical : .horizontal,
                          label: {})
                .font(.evy)
                .lineLimit(multiLine ? 10... : 1...)
                .focused($focused)
                .onChange(of: focused) { oldValue, newValue in
                    if oldValue == true && newValue == false {
                        editing = false
                    }
                }
                .onChange(of: editableValue.value.value) { _, newValue in
                    try? EVY.updateValue(newValue, at: destination)
                }
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
                .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth)
                .opacity(Constants.borderOpacity)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            editing.toggle()
            focused.toggle()
        }
        .accessibilityIdentifier("textField_\(destination)")
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.createItem()
		
		return VStack {
		EVYTextField(input: "{formatDimension(width)}",
					 destination: "{width}",
					 placeholder: "10",
					 multiLine: true)
		
		EVYTextField(input: "{formatCurrency(price)}",
					 destination: "{price}",
					 placeholder: "10")
					 
		EVYTextField(input: "{title}",
					 destination: "{title}",
					 placeholder: "Sample placeholder",
					 multiLine: true)
		
		EVYTextField(input: "{title}",
					 destination: "{title}",
					 placeholder: "Sample placeholder")
			
			EVYTextField(input: "",
						 destination: "",
						 placeholder: "Sample placeholder")
		}
	}
}
