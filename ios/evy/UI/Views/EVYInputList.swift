//
//  EVYInputList.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputList: View {
  let data: String
  let format: String?
  var placeholder: String?
  private var values: EVYState<[String]>

  init(data: String, format: String?, placeholder: String?, scope: EVYScope? = nil) {
    self.data = data
    self.format = format
    self.placeholder = placeholder

    values = EVYState(
      textToWatch: data,
      scope: scope,
      setter: {
        do {
          let data = try EVY.getDataFromText(data)
          if case .array(let arrayValue) = data {
            return try arrayValue.map { json in
              try EVY.formatDataOrToString(json: json, format: format)
            }
          } else {
            return [
              try EVY.formatDataOrToString(json: data, format: format)
            ]
          }
        } catch {
        }

        return []
      })
  }

  var body: some View {
    EVYTextField(
      source: "",
      destination: "",
      placeholder: values.value.isEmpty ? placeholder : nil
    )
    .disabled(true)
    .overlay {
      ScrollView(
        .horizontal,
        content: {
          HStack(spacing: Constants.majorPadding) {
            ForEach(values.value, id: \.self) { value in
              EVYRectangle.fitWidth(
                content: EVYTextView(value),
                style: .primary)
            }
          }
          .padding(Constants.majorPadding)
        }
      )
      .scrollIndicators(.hidden)
    }
  }
}

#Preview {
  EVYInputListPreview()
}

private struct EVYInputListPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    EVYInputList(
      data: "{selling_reasons}",
      format: "{$datum.value}",
      placeholder: "Search for reasons")
  }
}
