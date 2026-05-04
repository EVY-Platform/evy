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
  EVYButtonRowPreview()
}

private struct EVYButtonRowPreview: View {
  private let row = EVYButtonRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build button row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
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
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
