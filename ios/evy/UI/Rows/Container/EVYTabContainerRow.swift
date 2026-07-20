//
//  EVYTabContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

struct EVYTabContainerRow: View {

  private let view: TabContainerRowViewData
  private let childRef: EVYRowRef?
  private let childRefs: [EVYRowRef]
  @State private var selected: Int = 0
  @State private var tabs: [EVYTabContainerTab] = []

  @Environment(\.evyScope) private var evyScope

  init(
    view: TabContainerRowViewData,
    childRef: EVYRowRef?,
    childRefs: [EVYRowRef]
  ) {
    self.view = view
    self.childRef = childRef
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
        tabContent(tabs[selected])
          .id(tabs[selected].id)
      }
    }
    .containerTitleHeader(view.title)
    .onAppear {
      refreshTabs()
    }
    .onChange(of: view.source) { _, _ in
      refreshTabs()
    }
    .onChange(of: view.segments) { _, _ in
      refreshTabs()
    }
  }

  @ViewBuilder
  private func tabContent(_ tab: EVYTabContainerTab) -> some View {
    switch tab.content {
    case .dynamic(let instance):
      EVYRow(row: instance.displayRow, datum: instance.datum)
    case .static(let ref):
      EVYRow(ref: ref)
    }
  }

  private func refreshTabs() {
    tabs = EVYTabContainerTabs.build(
      source: view.source,
      childRef: childRef,
      staticSegments: view.segments,
      staticChildRefs: childRefs,
      scopeId: evyScope.cacheScopeId
    )
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
        "source": "{items}",
        "child": {
          "id": "tab-dynamic-template",
          "type": "Text",
          "actions": [],
          "title": "{$datum.title}",
          "subtitle": "",
          "icon": ""
        },
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
