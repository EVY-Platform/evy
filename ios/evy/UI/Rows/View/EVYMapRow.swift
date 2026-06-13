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
    VStack(alignment: .leading, spacing: Constants.padding) {
      if !view.content.title.isEmpty {
        EVYRowTitle(title: view.content.title)
      }
      EVYMap(location: resolvedLocation)
      if !view.content.subtitle.isEmpty {
        EVYTextView(view.content.subtitle, style: .info)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
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
