//
//  EVYTextRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextRow: View {

  private let view: TextRowViewData
  @State private var showSheet = false
  @State private var canBeExpanded = false

  init(view: TextRowViewData) {
    self.view = view
  }

  var body: some View {
    let content = view.content
    let icon = content.icon.trimmingCharacters(in: .whitespacesAndNewlines)
    let hasAction = !content.action.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    let hasSubtitle = !content.subtitle.isEmpty
    let showIcon = !icon.isEmpty
    let hasTextSection =
      hasAction
      || !content.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

    VStack(alignment: .leading, spacing: 0) {
      if showIcon || !content.title.isEmpty || hasSubtitle {
        HStack(alignment: .top) {
          if showIcon {
            EVYTextView(icon, style: .body)
          }
          VStack(
            alignment: showIcon || (hasSubtitle && !content.title.isEmpty) ? .leading : .center,
            spacing: 0
          ) {
            if !content.title.isEmpty {
              EVYTextView(content.title)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(1)
                .truncationMode(.tail)
            }
            if hasSubtitle {
              EVYTextView(content.subtitle, style: .info)
                .frame(
                  maxWidth: .infinity,
                  alignment: showIcon || !content.title.isEmpty ? .leading : .center
                )
                .lineLimit(3)
                .truncationMode(.tail)
            }
          }
          .frame(
            maxWidth: .infinity,
            alignment: showIcon || (!content.title.isEmpty && hasSubtitle) ? .leading : .center
          )
        }
        .frame(maxWidth: showIcon || !content.title.isEmpty ? nil : .infinity)
      }

      if hasTextSection {
        if hasAction {
          actionText(content: content)
        } else {
          expandableText(content: content)
        }
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }

  private func actionText(content: TextRowContent) -> some View {
    HStack {
      EVYTextView(
        content.text,
        placeholder: content.placeholder,
        style: .info
      )
      .frame(maxWidth: .infinity, alignment: .leading)
      EVYTextView(content.action, style: .action)
    }
  }

  private func expandableText(content: TextRowContent) -> some View {
    VStack(alignment: .leading) {
      EVYTextView(content.text)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lineLimit(Int(view.max_lines) ?? 1)
        .background {
          ViewThatFits(in: .vertical) {
            EVYTextView(content.text).hidden()
            Color.clear.onAppear {
              canBeExpanded = true
            }
          }
        }
        .sheet(isPresented: $showSheet) {
          EVYTextView(content.text)
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(.top, Constants.majorPadding)
            .presentationDragIndicator(.visible)
        }
      if canBeExpanded {
        EVYTextView("Read more", style: .action)
          .padding(.vertical, Constants.padding)
      }
    }
    .contentShape(Rectangle())
    .onTapGesture {
      if canBeExpanded {
        showSheet.toggle()
      }
    }
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
            "text": "This is a sample text row with some descriptive content to display. It can be quite long and the user can tap to expand it.",
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
            "text": "This is a sample text row with some descriptive content to display. It can be quite long and the user can tap to expand it.",
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
