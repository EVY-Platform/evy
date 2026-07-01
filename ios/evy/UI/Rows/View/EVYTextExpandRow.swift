//
//  EVYTextExpandRow.swift
//  evy
//

import SwiftUI

struct EVYTextExpandRow: View {

  private let view: TextExpandRowViewData
  private let collapsedLineCount = 3

  @State private var expanded = false
  @State private var canExpand = false

  init(view: TextExpandRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .frame(maxWidth: .infinity, alignment: .leading)
          .lineLimit(1)
          .truncationMode(.tail)
      }

      if let text = view.text, !text.isEmpty {
        EVYTextView(text)
          .frame(maxWidth: .infinity, alignment: .leading)
          .lineLimit(expanded ? nil : collapsedLineCount)
          .truncationMode(.tail)
          .background {
            if !expanded {
              ViewThatFits(in: .vertical) {
                EVYTextView(text)
                  .frame(maxWidth: .infinity, alignment: .leading)
                  .hidden()
                Color.clear.onAppear {
                  canExpand = true
                }
              }
            }
          }
      }

      if canExpand && !expanded, let expandLabel = view.expandLabel, !expandLabel.isEmpty {
        Button {
          expanded = true
        } label: {
          EVYTextView(expandLabel, style: .action)
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
        "actions": [],
        "visible": "true",
        "title": "About this item",
        "text": "This is a longer description that may be truncated when it exceeds the maximum number of lines configured for this row.",
        "expandLabel": "Read more"
      }
      """,
    failureMessage: "Unable to build text expand row preview"
  )
}
