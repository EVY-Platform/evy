//
//  EVYTextExpandRow.swift
//  evy
//

import SwiftUI

struct EVYTextExpandRow: View {

  private let view: TextExpandRowViewData
  private let rowId: String
  private let onExpandTapped: () -> Void
  private let collapsedLineCount = 3

  @State private var expanded = false
  @State private var canExpand = false

  init(
    view: TextExpandRowViewData,
    rowId: String = "",
    onExpandTapped: @escaping () -> Void
  ) {
    self.view = view
    self.rowId = rowId
    self.onExpandTapped = onExpandTapped
  }

  private var isCollapsible: Bool {
    !(view.expandLabel?.isEmpty ?? true)
  }

  private var isExpanded: Bool {
    !isCollapsible || expanded
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
          .lineLimit(isExpanded ? nil : collapsedLineCount)
          .truncationMode(.tail)
          .background {
            if !isExpanded {
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

      if canExpand && !isExpanded, let expandLabel = view.expandLabel {
        Button {
          onExpandTapped()
        } label: {
          EVYTextView(expandLabel, style: .action)
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
    .onReceive(NotificationCenter.default.publisher(for: .evyExpandTextRow)) { notification in
      guard let targetRowId = notification.object as? String, targetRowId == rowId else { return }
      expanded = true
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-expand-row",
        "type": "TextExpand",
        "actions": [{"condition": "", "true": "{expand_text(preview-text-expand-row)}", "false": ""}],
        "visible": "true",
        "title": "About this item",
        "text": "This is a longer description that may be truncated when it exceeds the maximum number of lines configured for this row.",
        "expandLabel": "Read more"
      }
      """,
    failureMessage: "Unable to build text expand row preview"
  )
}
