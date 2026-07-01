//
//  EVYDropdownRow.swift
//  evy
//
//  Created by Clemence Chalot on 24/03/2024.
//

import SwiftUI

struct EVYDropdownRow: View {

  private let view: DropdownRowViewData

  init(view: DropdownRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      EVYDropdown(
        title: view.title ?? "",
        placeholder: view.placeholder,
        data: view.source,
        valueTemplate: view.value,
        destination: view.destination
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
        "value": "{$datum.value}",
        "placeholder": "Select a condition"
      }
      """,
    failureMessage: "Unable to build dropdown row preview"
  )
}
