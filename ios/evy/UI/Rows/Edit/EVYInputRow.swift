//
//  EVYInputRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYInputRow: View {

  private let view: InputRowViewData
  private let isInteractive: Bool

  init(view: InputRowViewData, isInteractive: Bool = true) {
    self.view = view
    self.isInteractive = isInteractive
  }

  var body: some View {
    EVYTitledTextFieldRow(
      title: view.title,
      source: view.source,
      destination: view.destination,
      placeholder: view.placeholder,
      isInteractive: isInteractive
    )
  }
}

/// Shared skeleton for rows rendering an optional title above an `EVYTextField`.
struct EVYTitledTextFieldRow: View {
  let title: String?
  let source: String?
  let destination: String
  let placeholder: String?
  let multiLine: Bool
  let isInteractive: Bool

  init(
    title: String?,
    source: String?,
    destination: String,
    placeholder: String?,
    multiLine: Bool = false,
    isInteractive: Bool = true
  ) {
    self.title = title
    self.source = source
    self.destination = destination
    self.placeholder = placeholder
    self.multiLine = multiLine
    self.isInteractive = isInteractive
  }

  var body: some View {
    VStack(alignment: .leading) {
      if let title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      EVYTextField(
        source: source,
        destination: destination,
        placeholder: placeholder,
        multiLine: multiLine,
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
        "source": "{item.title}",
        "destination": "{item.title}",
        "actions": [],
        "title": "Item title",
        "placeholder": "Enter a title"
      }
      """,
    failureMessage: "Unable to build input row preview"
  )
}
