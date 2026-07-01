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
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(3)
            .truncationMode(.tail)
        }
      }
      if let action = content.action, !action.isEmpty {
        EVYTextView(action, style: .action)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
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
