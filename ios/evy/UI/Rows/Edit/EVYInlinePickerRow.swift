//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRow: View {

  private let view: InlinePickerRowViewData
  private let onOptionTapped: EVYRowTapCallback<EVYJson>

  init(
    view: InlinePickerRowViewData,
    onOptionTapped: @escaping EVYRowTapCallback<EVYJson>
  ) {
    self.view = view
    self.onOptionTapped = onOptionTapped
  }

  @Environment(\.evyScope) private var evyScope

  var body: some View {
    EVYInlinePicker(
      title: view.title ?? "",
      data: view.source ?? "",
      valueTemplate: view.value,
      destination: view.destination ?? "",
      onOptionTapped: onOptionTapped,
      scope: evyScope
    )
    .titledRow(view.title)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-inlinepicker-row",
        "type": "inline_picker",
        "source": "{durations}",
        "destination": "{item.duration}",
        "actions": {"tap": [{"condition": "", "true": "{select($datum)}", "false": ""}]},
        "title": "Duration",
        "value": "{$datum.value}"
      }
      """,
    failureMessage: "Unable to build inline picker row preview"
  )
}
