//
//  EVYTextActionRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextActionRow: View {

  private let view: TextActionRowViewData
  private let actions: [UI_RowAction]

  init(view: TextActionRowViewData, actions: [UI_RowAction]) {
    self.view = view
    self.actions = actions
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      HStack {
        EVYTextView(
          view.content.text,
          placeholder: view.content.placeholder,
          style: .info
        )
        .frame(maxWidth: .infinity, alignment: .leading)
        EVYTextView(view.content.action, style: .action)
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-textaction-row",
        "type": "TextAction",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Text Action Row",
            "text": "Current value",
            "placeholder": "No value set",
            "action": "Edit"
          }
        }
      }
      """,
    failureMessage: "Unable to build text action row preview"
  )
}
