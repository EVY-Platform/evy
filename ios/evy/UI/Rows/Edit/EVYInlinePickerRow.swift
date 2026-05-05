//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRow: View {

  private let view: InlinePickerRowViewData
  private let source: String
  private let destination: String

  init(view: InlinePickerRowViewData, source: String, destination: String) {
    self.view = view
    self.source = source
    self.destination = destination
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      if !destination.isEmpty {
        EVYInlinePicker(
          title: view.content.title,
          data: source,
          format: view.content.format,
          destination: destination
        )
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-inlinepicker-row",
        "type": "InlinePicker",
        "source": "{durations}",
        "destination": "{items.duration}",
        "actions": [],
        "view": {
          "content": {
            "title": "Duration",
            "format": "{$datum:value}"
          }
        }
      }
      """,
    failureMessage: "Unable to build inline picker row preview"
  )
}
