//
//  EVYHorizontalContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYHorizontalContainerRow: View {

  private let view: HorizontalContainerRowViewData
  private let childRefs: [EVYRowRef]

  init(
    view: HorizontalContainerRowViewData,
    childRefs: [EVYRowRef]
  ) {
    self.view = view
    self.childRefs = childRefs
  }

  var body: some View {
    HStack(alignment: .top) {
      ForEach(childRefs, id: \.id) { ref in
        EVYRow(ref: ref)
      }
    }
    .containerTitleHeader(view.title)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-horizontal-row",
        "type": "HorizontalContainer",
        "actions": [],
        "title": "Horizontal Container Preview",
        "children": [
          {
            "id": "horizontal-child-1",
            "type": "Text",
            "actions": [],
            "title": "First Child",
            "subtitle": "This is the first column item",
            "icon": "::star::"
          },
          {
            "id": "horizontal-child-2",
            "type": "Text",
            "actions": [],
            "title": "Second Child",
            "subtitle": "This is the second column item",
            "icon": ""
          }
        ]
      }
      """,
    failureMessage: "Unable to build horizontal container row preview"
  )
}
