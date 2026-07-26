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

  @Environment(\.evyScope) private var evyScope

  var body: some View {
    EVYInputList(
      data: view.source,
      format: view.format,
      placeholder: view.placeholder,
      scope: evyScope
    )
    .titledRow(view.title)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-inputlist-row",
        "type": "InputList",
        "source": "{tags}",
        "actions": {},
        "title": "Tags",
        "format": "{$datum}",
        "placeholder": "Add tags to improve search"
      }
      """,
    failureMessage: "Unable to build input list row preview"
  )
}
