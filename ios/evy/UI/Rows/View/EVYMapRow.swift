//
//  EVYMapRow.swift
//  evy
//

import SwiftUI

struct EVYMapRow: View {

  private let view: MapRowViewData
  private let location: EVYState<EVYJson>

  init(view: MapRowViewData, scope: EVYScope? = nil) {
    self.view = view
    self.location = EVYState(
      textToWatch: view.source,
      scope: scope,
      setter: { Self.resolveLocation(source: view.source) }
    )
  }

  private static func resolveLocation(source: String) -> EVYJson {
    guard !source.isEmpty else { return .string("") }
    return (try? EVY.getDataFromText(source)) ?? .string(source)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: Constants.padding) {
      EVYMap(location: location.value)
      if let subtitle = view.subtitle, !subtitle.isEmpty {
        EVYTextView(subtitle, style: .info)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .titledRow(view.title, spacing: Constants.padding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-map-row",
        "type": "map",
        "source": "{user.address}",
        "actions": {},
        "title": "Pickup location",
        "subtitle": "Meet near the main entrance"
      }
      """,
    failureMessage: "Unable to build map row preview"
  )
}
