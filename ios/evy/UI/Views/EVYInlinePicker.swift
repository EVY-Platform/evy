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

    private var options: [EVYJson] = []
    private var selectedIdentifiers: EVYState<[String]>

    init(title: String,
         data: String,
         format: String,
         destination: String)
    {
        self.title = title
        self.format = format
        self.destination = destination

        var loadedOptions: [EVYJson] = []
        do {
            let data = try EVY.getDataFromText(data)
            if case let .array(arrayValue) = data {
                loadedOptions.append(contentsOf: arrayValue)
            }
        } catch {
            #if DEBUG
            print("[EVYInlinePicker] Error loading options: \(error)")
            #endif
        }
        options = loadedOptions

        selectedIdentifiers = EVYState(watch: destination, setter: {
            do {
                let selected = try EVY.getDataFromText($0)
                guard case let .array(arrayValue) = selected else {
                    throw EVYError.invalidData(context: "InlinePicker destination '\($0)' must be an array.")
                }
                return arrayValue.map { $0.identifierValue() }
            } catch {
                NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
                #if DEBUG
                print("[EVYInlinePicker] Error loading selection: \(error)")
                #endif
            }
            return []
        })
    }

    private func performAction(option: EVYJson) {
        let optionIdentifier = option.identifierValue()
        do {
            var updatedIdentifiers = selectedIdentifiers.value.filter {
                $0 != optionIdentifier
            }
            if updatedIdentifiers.count == selectedIdentifiers.value.count {
                updatedIdentifiers.append(optionIdentifier)
            }
            let encoded = try JSONEncoder().encode(updatedIdentifiers)
            try EVY.updateData(encoded, at: destination)
        } catch {
            #if DEBUG
            print("[EVYInlinePicker] Error updating selection: \(error)")
            #endif
        }
    }

    var body: some View {
        HStack {
            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                let isSelected = selectedIdentifiers.value.contains(option.identifierValue())
                Button(action: {
                    performAction(option: option)
                }) {
                    let formatted = (try? EVY.formatDataOrToString(json: option, format: format))
                        ?? option.toString()
                    let textView = EVYTextView(formatted)
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
		try! EVY.getUserData()
		try! await EVY.createItem()

		return EVYInlinePicker(title: "Dropdown",
							   data: "{durations}",
							   format: "{$datum:value}",
							   destination: "{duration}")
	}
}
