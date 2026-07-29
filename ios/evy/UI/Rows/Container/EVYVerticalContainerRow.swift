//
//  EVYVerticalContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYVerticalContainerRow: View {

  private let view: VerticalContainerRowViewData
  private let childRefs: [EVYRowRef]
  private let datum: EVYJson?

  init(
    view: VerticalContainerRowViewData,
    childRefs: [EVYRowRef],
    datum: EVYJson?
  ) {
    self.view = view
    self.childRefs = childRefs
    self.datum = datum
  }

  var body: some View {
    Group {
      ForEach(childRefs, id: \.id) { ref in
        EVYRow(ref: ref, datum: datum)
          .padding(.vertical, Constants.minorPadding)
      }
    }
    .containerTitleHeader(view.title)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-vertical-row",
        "type": "VerticalContainer",
        "actions": {},
        "title": "Vertical Container Preview",
        "children": [
          {
            "id": "vertical-extra-child",
            "type": "Text",
            "actions": {},
            "title": "Static row",
            "subtitle": "Static child content",
            "icon": ""
          }
        ]
      }
      """,
    failureMessage: "Unable to build vertical container row preview"
  )
}
