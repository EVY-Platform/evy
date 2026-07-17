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
    EVYTitleSubtitleRow(
      title: view.title,
      subtitle: view.subtitle,
      centerSubtitleWhenTitleEmpty: true
    ) {
      if let label = view.label, !label.isEmpty {
        EVYTextView(label, style: .info)
      }
    }
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
