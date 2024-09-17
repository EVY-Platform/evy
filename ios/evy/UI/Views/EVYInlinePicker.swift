//
//  EVYInlinePicker.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI
    
struct EVYInlinePicker: View {
    let title: String
    let value: String
    let destination: String
    
    private var options: EVYJsonArray = []
    
    @State private var selection: EVYJson
    
    init(title: String, value: String, data: String, destination: String) {
        self.title = title
        self.value = value
        self.destination = destination
        
        do {
            let data = try EVY.getDataFromText(data)
            if case let .array(arrayValue) = data {
                self.options.append(contentsOf: arrayValue)
            }
        } catch {}
        
        _selection = State(initialValue: self.options.first!)
        
        do {
            let selected = try EVY.getDataFromText(value)
            if case let .string(stringValue) = selected {
                let matching = self.options.first { option in
                    return option.identifierValue() == stringValue
                }
                if matching != nil {
                    _selection = State(initialValue: matching!)
                }
            }
        } catch {}
    }
    
    private func performAction(option: EVYJson) -> Void {
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
                    EVYRectangle.fitWidth(content: EVYTextView(option.displayValue()),
                                            style: isSelected ? .primary : .secondary)
                }
            }
        }
    }
}


#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    let durations = DataConstants.durations.data(using: .utf8)!
    try! EVY.data.create(key: "durations", data: durations)
    
    let durationJson = """
        "8e1cd2bf-d94f-4bb0-bd68-fc74434deabe"
    """
    let duration = durationJson.data(using: .utf8)!
    try! EVY.data.create(key: "duration", data: duration)
    
    return VStack {
        EVYInlinePicker(title: "Dropdown",
                        value: "{duration}",
                        data: "{durations}",
                        destination: "{duration}")
    }
}
