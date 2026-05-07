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
  EVYPreviewRow(
    json: """
      {
        "id": "preview-input-row",
        "type": "Input",
        "source": "",
        "destination": "{item.title}",
        "actions": [],
        "view": {
          "content": {
            "title": "Item title",
            "value": "{item.title}",
            "placeholder": "Enter a title"
          }
        }
      }
      """,
    failureMessage: "Unable to build input row preview"
  )
}
