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

  @Environment(\.evyScope) private var evyScope

  var body: some View {
    EVYDropdown(
      title: view.title ?? "",
      placeholder: view.placeholder,
      data: view.source,
      valueTemplate: view.value,
      destination: view.destination,
      scope: evyScope
    )
    .titledRow(view.title)
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
        "actions": {},
        "title": "Condition",
        "value": "{$datum.value}",
        "placeholder": "Select a condition"
      }
      """,
    failureMessage: "Unable to build dropdown row preview"
  )
}
