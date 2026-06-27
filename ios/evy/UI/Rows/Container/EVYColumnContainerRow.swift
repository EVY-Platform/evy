//
//  EVYColumnContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYColumnContainerRow: View {

  private let view: ColumnContainerRowViewData
  private let childRefs: [EVYRowRef]

  init(view: ColumnContainerRowViewData, childRefs: [EVYRowRef]) {
    self.view = view
    self.childRefs = childRefs
  }

  var body: some View {
    VStack(alignment: .leading) {
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
          .padding(.horizontal, Constants.majorPadding)
      }
      HStack(alignment: .top) {
        ForEach(childRefs, id: \.id) { ref in
          EVYRow(ref: ref)
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
        "title": "Column Container Preview",
        "children": [
          {
            "id": "column-child-1",
            "type": "Text",
            "source": "",
            "actions": [],
            "title": "First Child",
            "subtitle": "This is the first column item",
            "icon": "::star::"
          },
          {
            "id": "column-child-2",
            "type": "Text",
            "source": "",
            "actions": [],
            "title": "Second Child",
            "subtitle": "This is the second column item",
            "icon": ""
          }
        ]
      }
      """,
    failureMessage: "Unable to build column container row preview"
  )
}
