//
//  EVYButtonRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYButtonRow: View {
  @Environment(\.navigate) private var navigate

  private let view: ButtonRowViewData
  private let actions: [UI_RowAction]

  init(view: ButtonRowViewData, actions: [UI_RowAction]) {
    self.view = view
    self.actions = actions
  }

  private func performAction() {
    EVYActionRunner.run(actions: actions, navigate: navigate)
  }

  var body: some View {
    EVYButton(label: view.content.label, action: performAction)
      .frame(maxWidth: .infinity, alignment: .center)
      .padding(.top, Constants.minorPadding)
      .padding(.bottom, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-button-row",
        "type": "Button",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Preview Action",
            "label": "Tap me"
          }
        }
      }
      """,
    failureMessage: "Unable to build button row preview"
  )
}
