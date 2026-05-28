//
//  EVYSelectSegmentContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

struct EVYSelectSegmentContainerRow: View {

  private let view: SelectSegmentContainerRowViewData
  @State private var selected: Int = 0

  init(view: SelectSegmentContainerRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      EVYRowTitle(title: view.content.title)
      Picker("", selection: $selected) {
        ForEach(Array(view.content.segments.enumerated()), id: \.offset) { index, segment in
          Text(segment).tag(index)
        }
      }
      .pickerStyle(.segmented)
      .padding(.bottom, Constants.majorPadding)

      if selected < view.content.children.count {
        EVYRow(row: view.content.children[selected])
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-segment-row",
        "type": "SelectSegmentContainer",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Select Segment Preview",
            "segments": ["Tab One", "Tab Two"],
            "children": [
              {
                "id": "segment-tab-1",
                "type": "Info",
                "source": "",
                "actions": [],
                "view": {
                  "content": {
                    "title": "First Tab Content",
                    "subtitle": "Content for the first tab",
                    "icon": ""
                  }
                }
              },
              {
                "id": "segment-tab-2",
                "type": "Info",
                "source": "",
                "actions": [],
                "view": {
                  "content": {
                    "title": "Second Tab Content",
                    "subtitle": "Content for the second tab",
                    "icon": ""
                  }
                }
              }
            ]
          }
        }
      }
      """,
    failureMessage: "Unable to build select segment row preview"
  )
}
