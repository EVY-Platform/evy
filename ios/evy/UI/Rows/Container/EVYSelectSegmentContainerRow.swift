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
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
      }
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
  EVYSelectSegmentContainerRowPreview()
}

private struct EVYSelectSegmentContainerRowPreview: View {
  private let row = EVYSelectSegmentContainerRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build select segment row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
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
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
