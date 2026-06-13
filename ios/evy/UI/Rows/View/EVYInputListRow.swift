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
      if !view.content.title.isEmpty {
        EVYRowTitle(title: view.content.title)
      }
      EVYInputList(
        data: source,
        format: view.content.format,
        placeholder: view.content.placeholder
      )
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
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
      """,
    failureMessage: "Unable to build input list row preview"
  )
}
