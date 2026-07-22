//
//  EVYTextAreaRow.swift
//  evy
//
//  Created by Clemence Chalot on 26/03/2024.
//

import SwiftUI

struct EVYTextAreaRow: View {

  private let view: TextAreaRowViewData

  init(view: TextAreaRowViewData) {
    self.view = view
  }

  var body: some View {
    EVYTitledTextFieldRow(
      title: view.title,
      source: view.source,
      destination: view.destination ?? "",
      placeholder: view.placeholder,
      multiLine: true
    )
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-textarea-row",
        "type": "TextArea",
        "source": "{item.description}",
        "destination": "{item.description}",
        "actions": {},
        "title": "Description",
        "placeholder": "Describe your item in detail"
      }
      """,
    failureMessage: "Unable to build text area row preview"
  )
}
