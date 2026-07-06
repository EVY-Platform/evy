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
    let source = view.source
    guard !source.isEmpty else { return .string("") }
    return (try? EVY.getDataFromText(source)) ?? .string(source)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: Constants.padding) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      EVYMap(location: resolvedLocation)
      if let subtitle = view.subtitle, !subtitle.isEmpty {
        EVYTextView(subtitle, style: .info)
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
        "source": "{user.address}",
        "actions": [],
        "title": "Pickup location",
        "subtitle": "Meet near the main entrance"
      }
      """,
    failureMessage: "Unable to build map row preview"
  )
}
