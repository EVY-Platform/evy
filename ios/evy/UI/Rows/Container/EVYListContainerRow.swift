//
//  EVYListContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYListContainerRow: View {

  private let view: ListContainerRowViewData
  private let childRefs: [EVYRowRef]

  init(view: ListContainerRowViewData, childRef _: EVYRowRef?, childRefs: [EVYRowRef]) {
    self.view = view
    self.childRefs = childRefs
  }

  var body: some View {
    VStack(alignment: .leading) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
          .padding(.horizontal, Constants.majorPadding)
      }
      ForEach(childRefs, id: \.id) { ref in
        EVYRow(ref: ref)
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-list-row",
        "type": "ListContainer",
        "actions": [],
        "title": "List Container Preview",
        "child": {
          "id": "list-child-template",
          "type": "Text",
          "actions": [],
          "title": "{$datum.title}",
          "subtitle": "",
          "icon": ""
        },
        "children": [
          {
            "id": "list-extra-child",
            "type": "Text",
            "actions": [],
            "title": "Extra row",
            "subtitle": "Static child below dynamic rows",
            "icon": ""
          }
        ]
      }
      """,
    failureMessage: "Unable to build list container row preview"
  )
}
