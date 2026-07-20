//
//  EVYTextField.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

@MainActor
enum EVYTextResolver {
  static func resolveDisplay(from source: String?, destination: String) -> EVYValue {
    let text = EVY.displayText(fromSource: source, destination: destination)
    return EVYValue(text, nil, nil)
  }

  static func resolveEditable(from source: String?, destination: String) -> EVYValue {
    let text = EVY.editableText(fromSource: source, destination: destination)
    return EVYValue(text, nil, nil)
  }
}

struct EVYTextField: View {
  let destination: String
  let placeholder: String?
  let multiLine: Bool
  let source: String?
  let isInteractive: Bool

  let displayValue: EVYState<EVYValue>
  let placeholderValue: EVYState<EVYValue>

  @FocusState private var focused: Bool
  @State private var editing: Bool = false
  @State private var localEditText: String = ""

  init(
    source: String?,
    destination: String,
    placeholder: String?,
    multiLine: Bool = false,
    isInteractive: Bool = true
  ) {
    self.source = source
    self.placeholder = placeholder
    self.destination = destination
    self.multiLine = multiLine
    self.isInteractive = isInteractive

    let watchTargets = EVY.watchTargets(forSource: source, destination: destination)
    self.displayValue = EVYState(
      watches: watchTargets,
      setter: {
        EVYTextResolver.resolveDisplay(from: source, destination: destination)
      })
    self.placeholderValue = EVYState(
      textToWatch: placeholder,
      setter: {
        EVYTextResolver.resolveValue(from: placeholder)
      })
  }

  var body: some View {
    Group {
      if !editing || destination.isEmpty {
        let displayText = displayValue.value.toString()
        let placeholderText = placeholderValue.value.toString()

        if !displayText.isEmpty {
          EVYTextView(displayText)
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if !placeholderText.isEmpty {
          EVYTextView(placeholderText, style: .info)
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
          // Spacer so the field stays tappable when display and placeholder are empty.
          Text(" ")
            .font(.evy)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      } else {
        TextField(
          text: $localEditText,
          prompt: EVYTextView(placeholderValue.value.toString()).toText(),
          axis: multiLine ? .vertical : .horizontal,
          label: {}
        )
        .font(.evy)
        .lineLimit(multiLine ? 10... : 1...)
        .focused($focused)
        .onChange(of: focused) { oldValue, newValue in
          if oldValue == true && newValue == false {
            editing = false
          }
        }
        .onChange(of: localEditText) { _, newValue in
          try? EVY.writeRawValue(newValue, to: destination)
        }
        .onSubmit {
          editing = false
          focused = false
        }
      }
    }
    .evyFieldChrome()
    .onTapGesture {
      guard isInteractive else { return }
      if !editing {
        localEditText =
          EVYTextResolver.resolveEditable(
            from: source,
            destination: destination
          ).value
        editing = true
        focused = true
      }
    }
    .allowsHitTesting(isInteractive)
    .accessibilityIdentifier("textField_\(destination)")
  }
}

#Preview {
  EVYTextFieldPreview()
}

private struct EVYTextFieldPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    VStack {
      EVYTextField(
        source: "{formatDimension(item.dimensions.width)}",
        destination: "{item.dimensions.width}",
        placeholder: "10",
        multiLine: true)

      EVYTextField(
        source: "{formatCurrency(item.price)}",
        destination: "{item.price}",
        placeholder: "10")

      EVYTextField(
        source: "{item.title}",
        destination: "{item.title}",
        placeholder: "Sample placeholder",
        multiLine: true)

      EVYTextField(
        source: nil,
        destination: "{item.title}",
        placeholder: "Destination-only title")

      EVYTextField(
        source: "",
        destination: "",
        placeholder: "Sample placeholder")
    }
  }
}

extension EVYTextResolver {
  static func resolveValue(from text: String?, editing: Bool = false) -> EVYValue {
    guard let text else { return EVYValue("", nil, nil) }
    if let resolvedValue = try? EVY.getValueFromText(text, editing: editing) {
      return resolvedValue
    }
    if EVY.parsePropsFromText(text) == text {
      return EVYValue(text, nil, nil)
    }
    return EVYValue("", nil, nil)
  }
}
