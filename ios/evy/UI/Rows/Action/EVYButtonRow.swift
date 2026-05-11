//
//  EVYButtonRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYButtonRow: View {
  private let view: ButtonRowViewData
  private let action: () -> Void

  init(view: ButtonRowViewData, action: @escaping () -> Void) {
    self.view = view
    self.action = action
  }

  var body: some View {
    EVYButton(label: view.content.label, action: action)
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
