//
//  EVYMapRow.swift
//  evy
//

import SwiftUI

struct EVYMapRow: View {

  private let view: MapRowViewData

  init(view: MapRowViewData) {
    self.view = view
  }

  private var resolvedLocation: EVYJson {
    (try? EVY.getDataFromText(view.content.location)) ?? .string(view.content.location)
  }

  var body: some View {
    EVYMap(
      title: view.content.title,
      location: resolvedLocation,
      subtitle: view.content.subtitle
    )
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-map-row",
        "type": "Map",
        "source": "",
        "destination": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Pickup location",
            "location": "{address.location}",
            "subtitle": "Meet near the main entrance"
          }
        }
      }
      """,
    failureMessage: "Unable to build map row preview"
  )
}
