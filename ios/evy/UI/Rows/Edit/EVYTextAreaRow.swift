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
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
      }
      EVYTextField(
        input: view.value,
        destination: destination,
        placeholder: view.placeholder,
        multiLine: true
      )
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-textarea-row",
        "type": "TextArea",
        "source": "",
        "destination": "{item.description}",
        "actions": [],
        "title": "Description",
        "value": "{item.description}",
        "placeholder": "Describe your item in detail"
      }
      """,
    failureMessage: "Unable to build text area row preview"
  )
}
