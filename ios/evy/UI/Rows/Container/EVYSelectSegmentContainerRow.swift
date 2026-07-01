//
//  EVYSelectSegmentContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

struct EVYSelectSegmentContainerRow: View {

  private let view: SelectSegmentContainerRowViewData
  private let childRefs: [EVYRowRef]
  @State private var selected: Int = 0

  init(view: SelectSegmentContainerRowViewData, childRefs: [EVYRowRef]) {
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
      Picker("", selection: $selected) {
        ForEach(Array(view.segments.enumerated()), id: \.offset) { index, segment in
          Text(segment).tag(index)
        }
      }
      .pickerStyle(.segmented)
      .padding(.horizontal, Constants.majorPadding)
      .padding(.bottom, Constants.majorPadding)

      if selected < childRefs.count {
        EVYRow(ref: childRefs[selected])
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
        "actions": [],
        "title": "Select Segment Preview",
        "segments": ["Tab One", "Tab Two"],
        "children": [
          {
            "id": "segment-tab-1",
            "type": "Text",
            "actions": [],
            "title": "First Tab Content",
            "subtitle": "Content for the first tab",
            "icon": ""
          },
          {
            "id": "segment-tab-2",
            "type": "Text",
            "actions": [],
            "title": "Second Tab Content",
            "subtitle": "Content for the second tab",
            "icon": ""
          }
        ]
      }
      """,
    failureMessage: "Unable to build select segment row preview"
  )
}
