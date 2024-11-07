//
//  EVYInlinePicker.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI
    
struct EVYInlinePicker: View {
    let title: String
    let format: String
    let destination: String
    
    private var options: EVYJsonArray = []
    
    @State private var selection: EVYJson
    
    init(title: String, data: String, format: String, destination: String) {
        self.title = title
        self.format = format
        self.destination = destination
        
        do {
            let data = try EVY.getDataFromText(data)
            if case let .array(arrayValue) = data {
                options.append(contentsOf: arrayValue)
            }
        } catch {}
        
        _selection = State(initialValue: options.first!)
        
        do {
            let selected = try EVY.getDataFromText(destination)
            if case let .string(stringValue) = selected {
                let matching = options.first { option in
                    option.identifierValue() == stringValue
                }
                if matching != nil {
                    _selection = State(initialValue: matching!)
                }
            }
        } catch {}
    }
    
    private func performAction(option: EVYJson) {
        selection = option
        
        try! EVY.updateValue(option.identifierValue(), at: destination)
    }
    
    var body: some View {
        HStack {
            ForEach(options, id: \.self) { option in
                let isSelected = option.identifierValue() == selection.identifierValue()
                Button(action: {
                    performAction(option: option)
                }) {
                    let textView = EVYTextView(EVY.formatData(json: option, format: format))
                    EVYRectangle.fitWidth(content: textView,
                                            style: isSelected ? .primary : .secondary)
                }
            }
        }
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.syncData()
		try! await EVY.createItem()
		return Group {
			EVYInlinePicker(title: "Dropdown",
							data: "{durations}",
							format: "{$0.value}",
							destination: "{duration}")
		}
	}
}
