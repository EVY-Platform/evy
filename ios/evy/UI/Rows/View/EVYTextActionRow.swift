//
//  EVYTextActionRow.swift
//  evy
//

import SwiftUI

struct EVYTextActionRow: View {

  private let view: TextActionRowViewData

  init(view: TextActionRowViewData) {
    self.view = view
  }

  var body: some View {
    EVYTitleSubtitleRow(
      title: view.title,
      subtitle: view.subtitle
    ) {
      if let action = view.action, !action.isEmpty {
        EVYTextView(action, style: .action)
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-action-row",
        "type": "TextAction",
        "actions": [],
        "visible": "true",
        "title": "Pickup location",
        "subtitle": "123 Main St, Sydney",
        "action": "Change"
      }
      """,
    failureMessage: "Unable to build text action row preview"
  )
}
