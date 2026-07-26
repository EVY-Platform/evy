//
//  EVYSelectItem.swift
//  evy
//
//  Created by Geoffroy Lesage on 19/9/2024.
//

import SwiftUI

enum EVYSelectItemTarget: String {
  case single_identifier
  case single_value
  case single_bool
  case single_object
  case multi_identifier
  case multi_value
  case multi_object

  /// Whether `value` is currently selected at `destination`, per this target's semantics.
  @MainActor
  func isSelected(value: EVYJson, destination: String) throws -> Bool {
    switch self {
    case .single_identifier:
      let sourceId = value.identifierValue()
      let destinationId = try EVY.getDataFromText(destination).identifierValue()
      return sourceId == destinationId
    case .single_value:
      let sourceString = value.toString()
      let destinationString = try EVY.getDataFromText(destination).toString()
      return sourceString == destinationString
    case .single_bool:
      return try EVY.evaluateFromText(destination)
    case .single_object:
      let existingData = try EVY.getDataFromText(destination)
      return existingData.identifierValue() == value.identifierValue()
    case .multi_identifier, .multi_object:
      let existingData = try EVY.getDataFromText(destination)
      guard case .array(let arrayValue) = existingData else {
        return false
      }
      let valueId = value.identifierValue()
      return arrayValue.contains { $0.identifierValue() == valueId }
    case .multi_value:
      let existingData = try EVY.getDataFromText(destination)
      guard case .array(let arrayValue) = existingData else {
        return false
      }
      let valueString = value.toString()
      return arrayValue.contains { $0.toString() == valueString }
    }
  }

  /// Writes the updated selection for `value` to `destination`, given whether it was
  /// selected prior to this call, per this target's semantics.
  @MainActor
  func applySelection(value: EVYJson, currentlySelected: Bool, destination: String) throws {
    switch self {
    case .single_bool:
      let newValue = currentlySelected ? "false" : "true"
      try EVY.writeRawStringValue(newValue, to: destination)

    case .single_identifier, .single_value, .single_object:
      if !currentlySelected {
        switch self {
        case .single_identifier:
          try EVY.writeRawStringValue(value.identifierValue(), to: destination)
        case .single_object:
          try EVY.writeRawValue(value, to: destination)
        default:
          try EVY.writeRawStringValue(value.toString(), to: destination)
        }
      } else {
        try EVY.writeRawStringValue("", to: destination)
      }

    case .multi_identifier, .multi_value, .multi_object:
      let existingData = try EVY.getDataFromText(destination)
      guard case .array(let arrayValue) = existingData else {
        return
      }

      switch self {
      case .multi_identifier:
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
      case .multi_value:
        let valueString = value.toString()
        var updatedData = arrayValue.filter {
          $0.toString() != valueString
        }
        if updatedData.count == arrayValue.count {
          updatedData.append(value)
        }
        try EVY.writeRawValue(EVYJson.array(updatedData), to: destination)
      case .multi_object:
        let valueId = value.identifierValue()
        var updatedData = arrayValue.filter {
          $0.identifierValue() != valueId
        }
        if updatedData.count == arrayValue.count {
          updatedData.append(value)
        }
        try EVY.writeRawValue(EVYJson.array(updatedData), to: destination)
      default:
        break
      }
    }
  }
}

struct EVYSelectItem: View {
  let destination: String
  let value: EVYJson
  let valueTemplate: String?
  let selectionStyle: EVYRadioStyle
  let target: EVYSelectItemTarget
  let textStyle: EVYTextStyle
  let onTap: (@escaping () throws -> Void) -> Void

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
    onTap: @escaping (@escaping () throws -> Void) -> Void,
    scope: EVYScope? = nil
  ) {
    self.destination = destination
    self.value = value
    self.valueTemplate = valueTemplate
    self.selectionStyle = selectionStyle
    self.target = target
    self.textStyle = textStyle
    self.onTap = onTap

    self.displayLabel =
      displayLabel ?? (try? EVY.displayText(forDatum: value, valueTemplate: valueTemplate))
      ?? value.toString()

    selected = EVYState(
      textToWatch: destination,
      scope: scope,
      setter: {
        (try? target.isSelected(value: value, destination: destination)) ?? false
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
      let performDefault: () throws -> Void = {
        try target.applySelection(
          value: value, currentlySelected: selected.value, destination: destination)
      }
      onTap(performDefault)
    }
  }
}

#Preview {
  EVYSellingReasonsSelectListPreview()
}
