//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRow: View {

  private let view: SearchRowViewData
  private let source: String
  private let childRef: EVYRowRef?

  init(view: SearchRowViewData, source: String, childRef: EVYRowRef?) {
    self.view = view
    self.source = source
    self.childRef = childRef
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
      }
      EVYSearch(
        source: source,
        placeholder: view.placeholder,
        resultTemplate: childRef?.templateRow()
      )
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-search-row",
        "type": "Search",
        "source": "{items}",
        "destination": "",
        "actions": [],
        "title": "Search preview",
        "placeholder": "Search items...",
        "child": {
          "id": "preview-search-result-template",
          "type": "Text",
          "source": "",
          "destination": "",
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
