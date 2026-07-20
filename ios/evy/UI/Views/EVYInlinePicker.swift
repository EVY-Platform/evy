//
//  EVYInlinePicker.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePicker: View {
  let title: String
  let valueTemplate: String?
  let destination: String

  private var options: [EVYJson] = []
  private var formattedOptionLabels: [String] = []
  private var selectedIdentifiers: EVYState<[String]>

  init(
    title: String,
    data: String,
    valueTemplate: String?,
    destination: String
  ) {
    self.title = title
    self.valueTemplate = valueTemplate
    self.destination = destination

    var loadedOptions = EVYOptionLoading.loadOptions(from: data)
    options = loadedOptions
    formattedOptionLabels = EVY.displayLabels(for: loadedOptions, valueTemplate: valueTemplate)

    selectedIdentifiers = EVYState(
      textToWatch: destination,
      setter: {
        do {
          let selected = try EVY.getDataFromText(destination)
          guard case .array(let arrayValue) = selected else {
            throw EVYError.invalidData(
              context: "InlinePicker destination '\(destination)' must be an array.")
          }
          return arrayValue.map { $0.identifierValue() }
        } catch {
          NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
        }
        return []
      })
  }

  private func performAction(option: EVYJson) {
    let optionIdentifier = option.identifierValue()
    do {
      let updatedIdentifiers = EVYSelectionHelpers.toggledIdentifier(
        optionIdentifier,
        in: selectedIdentifiers.value
      )
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
      ForEach(Array(options.enumerated()), id: \.offset) { index, option in
        let isSelected = selectedIdentifiers.value.contains(option.identifierValue())
        Button(action: {
          performAction(option: option)
        }) {
          let textView = EVYTextView(formattedOptionLabels[index])
          EVYRectangle.fitWidth(
            content: textView,
            style: isSelected ? .primary : .secondary)
        }
      }
    }
  }
}

#Preview {
  EVYInlinePickerPreview()
}

private struct EVYInlinePickerPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    EVYInlinePicker(
      title: "Duration",
      data: "{durations}",
      valueTemplate: "{$datum.value}",
      destination: "{item.duration}")
  }
}
