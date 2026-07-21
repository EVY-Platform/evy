//
//  EVYTabContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

struct EVYTabContainerRow: View {

  private let view: TabContainerRowViewData
  private let childRefs: [EVYRowRef]
  @State private var selected: Int = 0

  init(
    view: TabContainerRowViewData,
    childRefs: [EVYRowRef]
  ) {
    self.view = view
    self.childRefs = childRefs
  }

  private var tabCount: Int {
    min(view.segments.count, childRefs.count)
  }

  var body: some View {
    Group {
      Picker("", selection: $selected) {
        ForEach(0..<tabCount, id: \.self) { index in
          Text(view.segments[index]).tag(index)
        }
      }
      .pickerStyle(.segmented)
      .padding(.horizontal, Constants.majorPadding)
      .padding(.bottom, Constants.majorPadding)

      if selected < tabCount {
        EVYRow(ref: childRefs[selected])
          .id(childRefs[selected].id)
      }
    }
    .containerTitleHeader(view.title)
    .onChange(of: view.segments) { _, _ in
      if selected >= tabCount {
        selected = max(0, tabCount - 1)
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-tab-row",
        "type": "TabContainer",
        "actions": [],
        "title": "Tab Container Preview",
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
    failureMessage: "Unable to build tab container row preview"
  )
}
