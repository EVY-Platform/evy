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

  private var maxLines: Int {
    Int(view.max_lines) ?? 1
  }

  var body: some View {
    let content = view.content
    let icon = content.icon.trimmingCharacters(in: .whitespacesAndNewlines)
    let hasAction = !content.action.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    let hasTitle = !content.title.isEmpty
    let hasSubtitle = !content.subtitle.isEmpty
    let showIcon = !icon.isEmpty
    let hasTextSection =
      hasAction || !content.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

    VStack(alignment: .leading, spacing: 0) {
      if showIcon || hasTitle || hasSubtitle {
        HStack(alignment: .top) {
          if showIcon {
            EVYTextView(icon, style: .body)
          }
          VStack(
            alignment: showIcon || (hasSubtitle && hasTitle) ? .leading : .center,
            spacing: 0
          ) {
            if hasTitle {
              EVYTextView(content.title)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(1)
                .truncationMode(.tail)
            }
            if hasSubtitle {
              EVYTextView(content.subtitle, style: .info)
                .frame(
                  maxWidth: .infinity,
                  alignment: showIcon || hasTitle ? .leading : .center
                )
                .lineLimit(3)
                .truncationMode(.tail)
            }
          }
          .frame(
            maxWidth: .infinity,
            alignment: showIcon || (hasTitle && hasSubtitle) ? .leading : .center
          )
        }
        .frame(maxWidth: showIcon || hasTitle ? nil : .infinity)
      }

      if hasTextSection {
        if hasAction {
          HStack {
            EVYTextView(
              content.text,
              placeholder: content.placeholder,
              style: .info
            )
            .frame(maxWidth: .infinity, alignment: .leading)
            EVYTextView(content.action, style: .action)
          }
        } else {
          EVYTextView(content.text, placeholder: content.placeholder)
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(maxLines)
            .truncationMode(.tail)
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
            "text": "This is a sample text row with descriptive content. Long enough to demonstrate truncation.",
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
            "text": "This is a sample text row with an action label.",
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
