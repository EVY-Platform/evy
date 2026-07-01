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
    VStack(alignment: .leading) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      EVYTextField(
        source: view.source,
        destination: view.destination ?? "",
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
        "source": "{item.description}",
        "destination": "{item.description}",
        "actions": [],
        "title": "Description",
        "placeholder": "Describe your item in detail"
      }
      """,
    failureMessage: "Unable to build text area row preview"
  )
}
