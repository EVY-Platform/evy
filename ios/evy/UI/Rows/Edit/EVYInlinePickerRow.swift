//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRow: View {

  private let view: InlinePickerRowViewData

  init(view: InlinePickerRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      EVYInlinePicker(
        title: view.title ?? "",
        data: view.source ?? "",
        valueTemplate: view.value,
        destination: view.destination ?? ""
      )
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-inlinepicker-row",
        "type": "InlinePicker",
        "source": "{durations}",
        "destination": "{item.duration}",
        "actions": [],
        "title": "Duration",
        "value": "{$datum.value}"
      }
      """,
    failureMessage: "Unable to build inline picker row preview"
  )
}
