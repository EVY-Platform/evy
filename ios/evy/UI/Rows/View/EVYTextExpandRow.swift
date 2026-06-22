//
//  EVYTextExpandRow.swift
//  evy
//

import SwiftUI

struct EVYTextExpandRow: View {

  private let view: TextExpandRowViewData

  @State private var expanded = false
  @State private var canExpand = false

  init(view: TextExpandRowViewData) {
    self.view = view
  }

  private var maxLines: Int {
    Int(view.max_lines) ?? 3
  }

  var body: some View {
    let content = view.content

    VStack(alignment: .leading, spacing: 4) {
      if !content.title.isEmpty {
        EVYTextView(content.title)
          .frame(maxWidth: .infinity, alignment: .leading)
          .lineLimit(1)
          .truncationMode(.tail)
      }

      if !content.text.isEmpty {
        EVYTextView(content.text)
          .frame(maxWidth: .infinity, alignment: .leading)
          .lineLimit(expanded ? nil : maxLines)
          .truncationMode(.tail)
          .background {
            if !expanded {
              ViewThatFits(in: .vertical) {
                EVYTextView(content.text)
                  .frame(maxWidth: .infinity, alignment: .leading)
                  .hidden()
                Color.clear.onAppear {
                  canExpand = true
                }
              }
            }
          }
      }

      if canExpand && !expanded && !content.expandLabel.isEmpty {
        Button {
          expanded = true
        } label: {
          EVYTextView(content.expandLabel, style: .action)
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-expand-row",
        "type": "TextExpand",
        "source": "",
        "destination": "",
        "actions": [],
        "visible": "true",
        "view": {
          "content": {
            "title": "About this item",
            "text": "This is a longer description that may be truncated when it exceeds the maximum number of lines configured for this row.",
            "expandLabel": "Read more"
          },
          "max_lines": "3"
        }
      }
      """,
    failureMessage: "Unable to build text expand row preview"
  )
}
