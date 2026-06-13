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
  private let isInteractive: Bool

  init(view: InputRowViewData, destination: String, isInteractive: Bool = true) {
    self.view = view
    self.destination = destination
    self.isInteractive = isInteractive
  }

  var body: some View {
    VStack(alignment: .leading) {
      if !view.content.title.isEmpty {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      if !destination.isEmpty {
        EVYTextField(
          input: view.content.value,
          destination: destination,
          placeholder: view.content.placeholder,
          isInteractive: isInteractive
        )
      }
    }
    .padding(.horizontal, Constants.majorPadding)
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
