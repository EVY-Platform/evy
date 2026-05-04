//
//  EVYInputListRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputListRow: View {

  private let view: InputListRowViewData
  private let source: String

  init(view: InputListRowViewData, source: String) {
    self.view = view
    self.source = source
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      EVYInputList(
        data: source,
        format: view.content.format,
        placeholder: view.content.placeholder
      )
    }
  }
}

#Preview {
  EVYInputListRowPreview()
}

private struct EVYInputListRowPreview: View {
  private let row = EVYInputListRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build input list row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-inputlist-row",
        "type": "InputList",
        "source": "{tags}",
        "actions": [],
        "view": {
          "content": {
            "title": "Tags",
            "format": "{$datum}",
            "placeholder": "Add tags to improve search"
          }
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
