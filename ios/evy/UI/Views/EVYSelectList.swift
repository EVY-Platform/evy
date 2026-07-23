//
//  EVYSelectList.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSelectList: View {
  let options: [EVYJson]
  let valueTemplate: String?
  let destination: String

  private let optionLabels: [String]
  private let target: EVYSelectItemTarget
  @Environment(\.dismiss) private var dismiss

  init(
    options: [EVYJson],
    valueTemplate: String?,
    destination: String,
    optionLabels: [String]? = nil,
    target: EVYSelectItemTarget = .single_object
  ) {
    self.options = options
    self.valueTemplate = valueTemplate
    self.destination = destination
    self.target = target
    if let optionLabels, optionLabels.count == options.count {
      self.optionLabels = optionLabels
    } else {
      self.optionLabels = EVY.displayLabels(for: options, valueTemplate: valueTemplate)
    }
  }

  var body: some View {
    List {
      ForEach(Array(options.enumerated()), id: \.offset) { index, value in
        EVYSelectItem(
          destination: destination,
          value: value,
          valueTemplate: valueTemplate,
          displayLabel: optionLabels[index],
          selectionStyle: .single,
          target: target,
          onTap: { perform in
            try? perform()
            dismiss()
          }
        )
        .frame(height: Constants.listRowHeight)
      }
      .listRowSeparator(.hidden)
      .listRowBackground(Color.clear)
    }
    .listStyle(.inset)
    .scrollContentBackground(.hidden)
  }
}

#Preview {
  EVYSellingReasonsSelectListPreview()
}

/// Shared preview helper: renders an `EVYSelectList` over the mock `selling_reasons`
/// option set. Used by both `EVYSelectList` and `EVYSelectItem` previews.
struct EVYSellingReasonsSelectListPreview: View {
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
