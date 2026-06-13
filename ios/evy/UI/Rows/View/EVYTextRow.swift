//
//  EVYTextRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextRow: View {

  private let view: TextRowViewData

  init(view: TextRowViewData) {
    self.view = view
  }

  var body: some View {
    let content = view.content

    VStack(alignment: .leading) {
      HStack(alignment: .top) {
        if !content.icon.isEmpty {
          EVYTextView(content.icon, style: .body)
        }
        VStack(
          alignment: .leading,
        ) {
          if !content.title.isEmpty {
            EVYTextView(content.title)
              .lineLimit(1)
              .truncationMode(.tail)
          }
          if !content.subtitle.isEmpty {
            EVYTextView(content.subtitle, style: .info)
              .lineLimit(Int(view.max_lines) ?? 2)
              .truncationMode(.tail)
          }
          if !content.text.isEmpty {
            EVYTextView(
              content.text,
              placeholder: content.placeholder,
            )
            .lineLimit(Int(view.max_lines) ?? 2)
            .truncationMode(.tail)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if !content.action.isEmpty {
          EVYTextView(content.action, style: .action)
        }

      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview("Compact info mode") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row",
        "type": "Text",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Amazing Fridge",
            "subtitle": "A fantastic fridge in great condition",
            "icon": "::star::"
          }
        }
      }
      """,
    failureMessage: "Unable to build text row preview"
  )
}

#Preview("Text mode") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-text-mode",
        "type": "Text",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "About this item",
            "text": "This is a sample text row with descriptive content to display. It can be quite long, so creators can add a row action to show full details in a sheet.",
            "placeholder": "",
            "action": ""
          },
          "max_lines": "3"
        }
      }
      """,
    failureMessage: "Unable to build text row preview"
  )
}

#Preview("Combined") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-combined",
        "type": "Text",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "About this item",
            "subtitle": "Product details and description",
            "icon": "::star::",
            "text": "This is a sample text row with descriptive content to display alongside an action label.",
            "placeholder": "",
            "action": "Edit"
          },
          "max_lines": "3"
        }
      }
      """,
    failureMessage: "Unable to build text row preview"
  )
}
