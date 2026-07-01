//
//  EVYDropdown.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYDropdown: View {
  let title: String
  let destination: String
  let valueTemplate: String?
  let placeholder: String?

  private var options: [EVYJson] = []
  private var optionLabels: [String] = []
  private var selection: EVYState<String>
  @State private var showSheet = false

  init(
    title: String = "",
    placeholder: String? = nil,
    data: String,
    valueTemplate: String?,
    destination: String
  ) {
    self.title = title
    self.destination = destination
    self.valueTemplate = valueTemplate
    self.placeholder = placeholder

    var loadedOptions: [EVYJson] = []

    do {
      let data = try EVY.getDataFromText(data)
      if case .array(let arrayValue) = data {
        loadedOptions = arrayValue
      }
    } catch {
    }
    options = loadedOptions
    let loadedOptionLabels = EVY.displayLabels(for: loadedOptions, valueTemplate: valueTemplate)
    optionLabels = loadedOptionLabels

    selection = EVYState(
      textToWatch: destination,
      setter: {
        do {
          let value = try EVY.getDataFromText(destination)
          if case .string(let identifier) = value {
            if identifier.isEmpty { return "" }
            if let matchingOptionIndex = loadedOptions.firstIndex(where: {
              $0.identifierValue() == identifier
            }) {
              return loadedOptionLabels[matchingOptionIndex]
            }
          }
          return try EVY.displayText(forDatum: value, valueTemplate: valueTemplate)
        } catch {
          return ""
        }
      })
  }

  var body: some View {
    HStack {
      Button(action: { showSheet.toggle() }) {
        if selection.value.count > 0 {
          EVYTextView(selection.value)
        } else if let placeholder {
          EVYTextView(placeholder, style: .info)
        }
      }
      Spacer()
      EVYTextView("::chevron-down::")
    }
    .buttonStyle(.plain)
    .padding(
      EdgeInsets(
        top: Constants.fieldPadding,
        leading: Constants.minorPadding,
        bottom: Constants.fieldPadding,
        trailing: Constants.minorPadding)
    )
    .background(
      RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
        .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth)
        .opacity(Constants.borderOpacity)
    )
    .contentShape(Rectangle())
    .onTapGesture { showSheet.toggle() }
    .sheet(
      isPresented: $showSheet,
      content: {
        VStack {
          if title.count > 0 {
            EVYTextView(title).padding(.top, Constants.majorPadding)
          }
          EVYSelectList(
            options: options,
            valueTemplate: valueTemplate,
            destination: destination,
            optionLabels: optionLabels,
            target: .single_identifier)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.white.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(.white)
      })
  }
}

#Preview {
  EVYDropdownPreview()
}

private struct EVYDropdownPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    EVYDropdown(
      title: "Dropdown",
      placeholder: "A placeholder",
      data: "{conditions}",
      valueTemplate: "{$datum.value}",
      destination: "{item.condition}")
  }
}
