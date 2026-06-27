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
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
      }
      EVYTextField(
        input: view.value,
        destination: destination,
        placeholder: view.placeholder,
        isInteractive: isInteractive
      )
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
        "title": "Item title",
        "value": "{item.title}",
        "placeholder": "Enter a title"
      }
      """,
    failureMessage: "Unable to build input row preview"
  )
}
