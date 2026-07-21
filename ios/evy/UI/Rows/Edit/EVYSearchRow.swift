//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRow: View {

  private let view: SearchRowViewData
  private let childRef: EVYRowRef?

  @Environment(\.evyScope) private var evyScope

  init(view: SearchRowViewData, childRef: EVYRowRef?) {
    self.view = view
    self.childRef = childRef
  }

  var body: some View {
    EVYSearch(
      source: view.source,
      destination: view.destination,
      placeholder: view.placeholder,
      resultTemplate: childRef?.templateRow(),
      scopeId: evyScope.cacheScopeId,
      draftScopeId: evyScope.draftScopeId
    )
    .titledRow(view.title, spacing: 0)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-search-row",
        "type": "Search",
        "source": "{items}",
        "destination": "{selected_item}",
        "actions": [],
        "title": "Search preview",
        "placeholder": "Search items...",
        "child": {
          "id": "preview-search-result-template",
          "type": "Text",
          "actions": [],
          "title": "{$datum.title}",
          "subtitle": "{$datum.category}",
          "icon": "::search::"
        }
      }
      """,
    failureMessage: "Unable to build search row preview"
  ) {
    let previewItemsJSON = """
      [
        { "id": "preview-item-1", "title": "Amazing Fridge", "category": "Kitchen" },
        { "id": "preview-item-2", "title": "Amazing Freezer", "category": "Kitchen" },
        { "id": "preview-item-3", "title": "Vintage Printer", "category": "Office" }
      ]
      """
    if let data = previewItemsJSON.data(using: .utf8),
      let parsed = try? JSONDecoder().decode(EVYJson.self, from: data)
    {
      try? EVY.publicStore.applySyncedValue(
        namespace: EVYNamespace.local, resource: "items", value: parsed)
    }
    EVYPreviewMockData.seedCommon()
  }
}
