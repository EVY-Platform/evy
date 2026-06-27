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
    (try? EVY.getDataFromText(view.location)) ?? .string(view.location)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: Constants.padding) {
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
      }
      EVYMap(location: resolvedLocation)
      if !view.subtitle.isEmpty {
        EVYTextView(view.subtitle, style: .info)
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
        "title": "Pickup location",
        "location": "{address.location}",
        "subtitle": "Meet near the main entrance"
      }
      """,
    failureMessage: "Unable to build map row preview"
  )
}
