//
//  EVYVerticalContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYVerticalContainerRow: View {

  private let view: VerticalContainerRowViewData
  private let childRef: EVYRowRef?
  private let childRefs: [EVYRowRef]

  @Environment(\.evyScope) private var evyScope
  @State private var dynamicInstances: [EVYContainerDynamicInstance] = []

  init(
    view: VerticalContainerRowViewData,
    childRef: EVYRowRef?,
    childRefs: [EVYRowRef]
  ) {
    self.view = view
    self.childRef = childRef
    self.childRefs = childRefs
  }

  var body: some View {
    Group {
      ForEach(dynamicInstances) { instance in
        EVYRow(row: instance.displayRow, datum: instance.datum)
          .padding(.vertical, Constants.minorPadding)
      }
      ForEach(childRefs, id: \.id) { ref in
        EVYRow(ref: ref)
          .padding(.vertical, Constants.minorPadding)
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
        "id": "preview-vertical-row",
        "type": "VerticalContainer",
        "actions": [],
        "title": "Vertical Container Preview",
        "source": "{items}",
        "child": {
          "id": "vertical-child-template",
          "type": "Text",
          "actions": [],
          "title": "{$datum.title}",
          "subtitle": "",
          "icon": ""
        },
        "children": [
          {
            "id": "vertical-extra-child",
            "type": "Text",
            "actions": [],
            "title": "Extra row",
            "subtitle": "Static child below dynamic rows",
            "icon": ""
          }
        ]
      }
      """,
    failureMessage: "Unable to build vertical container row preview"
  )
}
