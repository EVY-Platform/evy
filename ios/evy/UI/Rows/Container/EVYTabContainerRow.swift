//
//  EVYTabContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

private struct EVYTabContainerTab: Identifiable, Equatable {
  let id: String
  let label: String
  let childRef: EVYRowRef
}

struct EVYTabContainerRow: View {

  private let view: TabContainerRowViewData
  private let childRefs: [EVYRowRef]
  @State private var selected: Int = 0
  @State private var tabs: [EVYTabContainerTab] = []

  init(
    view: TabContainerRowViewData,
    childRefs: [EVYRowRef]
  ) {
    self.view = view
    self.childRefs = childRefs
  }

  var body: some View {
    Group {
      Picker("", selection: $selected) {
        ForEach(Array(tabs.enumerated()), id: \.element.id) { index, tab in
          Text(tab.label).tag(index)
        }
      }
      .pickerStyle(.segmented)
      .padding(.horizontal, Constants.majorPadding)
      .padding(.bottom, Constants.majorPadding)

      if selected < tabs.count {
        EVYRow(ref: tabs[selected].childRef)
          .id(tabs[selected].id)
      }
    }
    .containerTitleHeader(view.title)
    .onAppear {
      refreshTabs()
    }
    .onChange(of: view.segments) { _, _ in
      refreshTabs()
    }
  }

  private func refreshTabs() {
    let staticCount = min(view.segments.count, childRefs.count)
    tabs = (0..<staticCount).map { index in
      let ref = childRefs[index]
      return EVYTabContainerTab(
        id: "static-\(ref.id)",
        label: view.segments[index],
        childRef: ref
      )
    }
    if selected >= tabs.count {
      selected = max(0, tabs.count - 1)
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
