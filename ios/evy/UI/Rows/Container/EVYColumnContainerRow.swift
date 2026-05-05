//
//  EVYColumnContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYColumnContainerRow: View {

  private let view: ColumnContainerRowViewData

  init(view: ColumnContainerRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      HStack(alignment: .top) {
        ForEach(Array(view.content.children.enumerated()), id: \.offset) { _, child in
          EVYRow(row: child)
        }
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-column-row",
        "type": "ColumnContainer",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Column Container Preview",
            "children": [
              {
                "id": "column-child-1",
                "type": "Info",
                "source": "",
                "actions": [],
                "view": {
                  "content": {
                    "title": "First Child",
                    "subtitle": "This is the first column item",
                    "icon": "::star::"
                  }
                }
              },
              {
                "id": "column-child-2",
                "type": "Info",
                "source": "",
                "actions": [],
                "view": {
                  "content": {
                    "title": "Second Child",
                    "subtitle": "This is the second column item",
                    "icon": ""
                  }
                }
              }
            ]
          }
        }
      }
      """,
    failureMessage: "Unable to build column container row preview"
  )
}
