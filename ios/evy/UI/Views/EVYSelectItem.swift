//
//  EVYSelectItem.swift
//  evy
//
//  Created by Geoffroy Lesage on 19/9/2024.
//

import SwiftUI

public enum EVYSelectItemTarget: String {
  case single_identifier
  case single_value
  case single_bool
  case single_object
  case multi_identifier
  case multi_value
  case multi_object
}

struct EVYSelectItem: View {
  let destination: String
  let value: EVYJson
  let valueTemplate: String?
  let selectionStyle: EVYRadioStyle
  let target: EVYSelectItemTarget
  let textStyle: EVYTextStyle
  let onSelect: (() -> Void)?

  private let displayLabel: String
  private var selected: EVYState<Bool>

  init(
    destination: String,
    value: EVYJson,
    valueTemplate: String?,
    displayLabel: String? = nil,
    selectionStyle: EVYRadioStyle,
    target: EVYSelectItemTarget,
    textStyle: EVYTextStyle = .body,
    onSelect: (() -> Void)? = nil
  ) {
    self.destination = destination
    self.value = value
    self.valueTemplate = valueTemplate
    self.selectionStyle = selectionStyle
    self.target = target
    self.textStyle = textStyle
    self.onSelect = onSelect

    self.displayLabel =
      displayLabel ?? (try? EVY.displayText(forDatum: value, valueTemplate: valueTemplate))
      ?? value.toString()

    selected = EVYState(
      textToWatch: destination,
      setter: {
        do {
          if target == .single_identifier {
            let sourceId = value.identifierValue()
            let destinationId = try EVY.getDataFromText(destination).identifierValue()
            return sourceId == destinationId
          } else if target == .single_value {
            let sourceString = value.toString()
            let destinationString = try EVY.getDataFromText(destination).toString()
            return sourceString == destinationString
          } else if target == .single_bool {
            return try EVY.evaluateFromText(destination)
          } else if target == .single_object {
            let existingData = try EVY.getDataFromText(destination)
            return existingData.identifierValue() == value.identifierValue()
          } else if target == .multi_identifier {
            let existingData = try EVY.getDataFromText(destination)
            guard case .array(let arrayValue) = existingData else {
              return false
            }
            let valueId = value.identifierValue()
            return arrayValue.contains { $0.identifierValue() == valueId }
          } else if target == .multi_value {
            let existingData = try EVY.getDataFromText(destination)
            guard case .array(let arrayValue) = existingData else {
              return false
            }
            let valueString = value.toString()
            return arrayValue.contains { $0.toString() == valueString }
          } else if target == .multi_object {
            let existingData = try EVY.getDataFromText(destination)
            guard case .array(let arrayValue) = existingData else {
              return false
            }
            let valueId = value.identifierValue()
            return arrayValue.contains { $0.identifierValue() == valueId }
          }
        } catch {
          return false
        }

        return false
      })
  }

  var body: some View {
    HStack {
      EVYTextView(displayLabel, style: textStyle)
        .frame(maxWidth: .infinity, alignment: .leading)
      EVYRadioButton(isSelected: selected.value, style: selectionStyle)
    }
    .contentShape(Rectangle())
    .onTapGesture {
      do {
        if target == .single_identifier
          || target == .single_value
          || target == .single_bool
          || target == .single_object
        {
          if target == .single_bool {
            let newValue = selected.value ? "false" : "true"
            try EVY.writeRawValue(newValue, to: destination)
          } else if !selected.value {
            if target == .single_identifier {
              try EVY.writeRawValue(value.identifierValue(), to: destination)
            } else if target == .single_object {
              try EVY.writeRawValue(value, to: destination)
            } else {
              try EVY.writeRawValue(value.toString(), to: destination)
            }
          } else {
            try EVY.writeRawValue("", to: destination)
          }
        } else {
          let existingData = try EVY.getDataFromText(destination)
          guard case .array(let arrayValue) = existingData else {
            return
          }

          if target == .multi_identifier {
            let valueId = value.identifierValue()
            var updatedData = arrayValue.filter {
              $0.identifierValue() != valueId
            }.map {
              $0.toString()
            }
            if updatedData.count == arrayValue.count {
              updatedData.append(value.identifierValue())
            }
            try EVY.writeRawValue(
              EVYJson.array(updatedData.map { .string($0) }),
              to: destination
            )
          } else if target == .multi_value {
            let valueString = value.toString()
            var updatedData = arrayValue.filter {
              $0.toString() != valueString
            }
            if updatedData.count == arrayValue.count {
              updatedData.append(value)
            }
            try EVY.writeRawValue(EVYJson.array(updatedData), to: destination)
          } else if target == .multi_object {
            let valueId = value.identifierValue()
            var updatedData = arrayValue.filter {
              $0.identifierValue() != valueId
            }
            if updatedData.count == arrayValue.count {
              updatedData.append(value)
            }
            try EVY.writeRawValue(EVYJson.array(updatedData), to: destination)
          }
        }

        onSelect?()
      } catch {
        #if DEBUG
          print("[EVYSelectItem] Error updating selection: \(error)")
        #endif
      }
    }
  }
}

#Preview {
  EVYSelectItemPreview()
}

private struct EVYSelectItemPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    Group {
      let options = try! EVY.getDataFromText("{selling_reasons}")
      switch options {
      case .array(let arrayValue):
        EVYSelectList(
          options: arrayValue,
          valueTemplate: "{$datum.value}",
          destination: "{item.selling_reason}")
      default:
        Text("error")
      }
    }
  }
}
