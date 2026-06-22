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
    let content = view.content

    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading) {
        if !content.title.isEmpty {
          EVYTextView(content.title)
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(1)
            .truncationMode(.tail)
        }
        if !content.subtitle.isEmpty {
          EVYTextView(content.subtitle, style: .info)
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(3)
            .truncationMode(.tail)
        }
      }
      if !content.action.isEmpty {
        EVYTextView(content.action, style: .action)
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
        "source": "",
        "destination": "",
        "actions": [],
        "visible": "true",
        "view": {
          "content": {
            "title": "Pickup location",
            "subtitle": "123 Main St, Sydney",
            "action": "Change"
          }
        }
      }
      """,
    failureMessage: "Unable to build text action row preview"
  )
}
