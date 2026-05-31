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

  init(view: SearchRowViewData, source: String) {
    self.view = view
    self.source = source
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      EVYRowTitle(title: view.content.title)
      EVYSearch(
        source: source,
        placeholder: view.content.placeholder,
        resultTemplate: view.content.child
      )
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYSearchRowPreview()
}

private struct EVYSearchRowPreview: View {
  private let row = EVYSearchRowPreview.makeSearchRow()

  init() {
    let previewItemsJSON = """
      [
        { "id": "preview-item-1", "title": "Amazing Fridge", "category": "Kitchen" },
        { "id": "preview-item-2", "title": "Amazing Freezer", "category": "Kitchen" },
        { "id": "preview-item-3", "title": "Vintage Printer", "category": "Office" }
      ]
      """

    if let previewItemsData = previewItemsJSON.data(using: .utf8),
      let parsed = try? JSONDecoder().decode(EVYJson.self, from: previewItemsData)
    {
      try? EVY.publicStore.applySyncedValue(
        namespace: EVYNamespace.local, resource: "items", value: parsed)
    }
  }

  var body: some View {
    if let row {
      EVYRow(row: row)
    } else {
      Text("Unable to build search row preview")
    }
  }

  private static func makeSearchRow() -> UI_Row? {
    let searchRowJSON = """
      {
        "id": "preview-search-row",
        "type": "Search",
        "source": "{items}",
        "destination": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Search preview",
            "placeholder": "Search items...",
            "child": {
              "id": "preview-search-result-template",
              "type": "Info",
              "source": "",
              "destination": "",
              "actions": [],
              "view": {
                "content": {
                  "title": "{$datum.title}",
                  "subtitle": "{$datum.category}",
                  "icon": "::search::"
                }
              }
            }
          }
        }
      }
      """

    guard let searchRowData = searchRowJSON.data(using: .utf8) else {
      return nil
    }

    return try? JSONDecoder().decode(UI_Row.self, from: searchRowData)
  }
}
