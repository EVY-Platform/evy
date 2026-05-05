//
//  EVYTextAreaRow.swift
//  evy
//
//  Created by Clemence Chalot on 26/03/2024.
//

import SwiftUI

struct EVYTextAreaRow: View {

  private let view: TextAreaRowViewData
  private let destination: String

  init(view: TextAreaRowViewData, destination: String) {
    self.view = view
    self.destination = destination
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      if !destination.isEmpty {
        EVYTextField(
          input: view.content.value,
          destination: destination,
          placeholder: view.content.placeholder,
          multiLine: true
        )
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-textarea-row",
        "type": "TextArea",
        "source": "",
        "destination": "{items.description}",
        "actions": [],
        "view": {
          "content": {
            "title": "Description",
            "value": "{items.description}",
            "placeholder": "Describe your item in detail"
          }
        }
      }
      """,
    failureMessage: "Unable to build text area row preview"
  )
}
