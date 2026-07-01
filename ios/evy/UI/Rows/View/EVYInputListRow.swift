//
//  EVYInputListRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 21/8/2024.
//

import SwiftUI

struct EVYInputListRow: View {

  private let view: InputListRowViewData

  init(view: InputListRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      EVYInputList(
        data: view.source,
        format: view.format,
        placeholder: view.placeholder
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
        "title": "Tags",
        "format": "{$datum}",
        "placeholder": "Add tags to improve search"
      }
      """,
    failureMessage: "Unable to build input list row preview"
  )
}
