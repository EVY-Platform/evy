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
    EVYButton(label: view.label, style: view.style, action: action)
      .frame(maxWidth: .infinity, alignment: .center)
      .padding(.horizontal, Constants.majorPadding)
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
        "actions": [],
        "title": "Preview Action",
        "label": "Tap me"
      }
      """,
    failureMessage: "Unable to build button row preview"
  )
}
