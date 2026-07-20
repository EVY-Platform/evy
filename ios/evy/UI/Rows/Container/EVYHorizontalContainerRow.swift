//
//  EVYHorizontalContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYHorizontalContainerRow: View {

  private let view: HorizontalContainerRowViewData
  private let childRef: EVYRowRef?
  private let childRefs: [EVYRowRef]

  @Environment(\.evyScope) private var evyScope
  @State private var dynamicInstances: [EVYContainerDynamicInstance] = []

  init(
    view: HorizontalContainerRowViewData,
    childRef: EVYRowRef?,
    childRefs: [EVYRowRef]
  ) {
    self.view = view
    self.childRef = childRef
    self.childRefs = childRefs
  }

  var body: some View {
    HStack(alignment: .top) {
      ForEach(dynamicInstances) { instance in
        EVYRow(row: instance.displayRow, datum: instance.datum)
      }
      ForEach(childRefs, id: \.id) { ref in
        EVYRow(ref: ref)
      }
    }
    .containerTitleHeader(view.title)
    .onAppear {
      refreshDynamicInstances()
    }
    .onChange(of: view.source) { _, _ in
      refreshDynamicInstances()
    }
  }

  private func refreshDynamicInstances() {
    dynamicInstances = EVYContainerDynamicChildren.instances(
      source: view.source,
      childRef: childRef,
      scopeId: evyScope.cacheScopeId
    )
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
        "source": "{items}",
        "child": {
          "id": "horizontal-child-template",
          "type": "Text",
          "actions": [],
          "title": "{$datum.title}",
          "subtitle": "",
          "icon": ""
        },
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
