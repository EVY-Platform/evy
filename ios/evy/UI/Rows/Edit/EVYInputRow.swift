//
//  EVYInputRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYInputRow: View {

  private let view: InputRowViewData
  private let destination: String

  init(view: InputRowViewData, destination: String) {
    self.view = view
    self.destination = destination
  }

  var body: some View {
    VStack(alignment: .leading) {
      EVYRowTitle(title: view.content.title)
      if !destination.isEmpty {
        EVYTextField(
          input: view.content.value,
          destination: destination,
          placeholder: view.content.placeholder
        )
      }
    }
  }
}

#Preview {
  EVYInputRowPreview()
}

private struct EVYInputRowPreview: View {
  private let row = EVYInputRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build input row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-input-row",
        "type": "Input",
        "source": "",
        "destination": "{items.title}",
        "actions": [],
        "view": {
          "content": {
            "title": "Item title",
            "value": "{items.title}",
            "placeholder": "Enter a title"
          }
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
