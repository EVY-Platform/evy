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
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
      }
      EVYDropdown(
        title: view.title,
        placeholder: view.placeholder,
        data: source,
        format: view.format,
        destination: destination
      )
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
        "title": "Condition",
        "format": "{$datum.value}",
        "placeholder": "Select a condition"
      }
      """,
    failureMessage: "Unable to build dropdown row preview"
  )
}
