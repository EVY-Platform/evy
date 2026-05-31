//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYDropdownRow: View {

  private let view: DropdownRowViewData
  private let source: String
  private let destination: String

  init(view: DropdownRowViewData, source: String, destination: String) {
    self.view = view
    self.source = source
    self.destination = destination
  }

  var body: some View {
    VStack(alignment: .leading) {
      EVYRowTitle(title: view.content.title)
      if !destination.isEmpty {
        EVYDropdown(
          title: view.content.title,
          placeholder: view.content.placeholder,
          data: source,
          format: view.content.format,
          destination: destination
        )
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-dropdown-row",
        "type": "Dropdown",
        "source": "{conditions}",
        "destination": "{item.condition}",
        "actions": [],
        "view": {
          "content": {
            "title": "Condition",
            "format": "{$datum.value}",
            "placeholder": "Select a condition"
          }
        }
      }
      """,
    failureMessage: "Unable to build dropdown row preview"
  )
}
