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
    let content = view

    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading) {
        if let title = content.title, !title.isEmpty {
          EVYTextView(title)
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(1)
            .truncationMode(.tail)
        }
        if let subtitle = content.subtitle, !subtitle.isEmpty {
          EVYTextView(subtitle, style: .info)
            .frame(
              maxWidth: .infinity,
              alignment: content.title?.isEmpty ?? true ? .center : .leading
            )
            .lineLimit(3)
            .truncationMode(.tail)
        }
      }
      if let label = content.label, !label.isEmpty {
        EVYTextView(label, style: .info)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview("Title, subtitle, and label") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-full",
        "type": "Text",
        "actions": [],
        "visible": "true",
        "title": "Pickup address",
        "subtitle": "123 Market Street, San Francisco",
        "label": "Default"
      }
      """,
    failureMessage: "Unable to build text row preview"
  )
}

#Preview("Title only") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-title-only",
        "type": "Text",
        "actions": [],
        "visible": "true",
        "title": "Pickup address"
      }
      """,
    failureMessage: "Unable to build title-only text row preview"
  )
}

#Preview("Subtitle only") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-subtitle-only",
        "type": "Text",
        "actions": [],
        "visible": "true",
        "subtitle": "Available between 10 AM and 2 PM"
      }
      """,
    failureMessage: "Unable to build subtitle-only text row preview"
  )
}
