//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRow: View {

  private let view: SearchRowViewData
  private let childRef: EVYRowRef?
  private let onSelect: ((EVYJson) -> Void)?

  @Environment(\.evyScope) private var evyScope

  // EVYSearch captures its source and result template in State(initialValue:)
  // closures, which SwiftUI never re-runs for the same view identity. Editing
  // the child template row (its own evy.rows record - nothing else observes
  // it) bumps the version, and the version keys EVYSearch's identity so a
  // fresh init picks up the changed template.
  @State private var childTemplate: EVYStoredRow?
  @State private var childTemplateVersion = 0

  // Inline children are runtime-generated, never edited as records; nil skips
  // the record watch (an empty id matches no record change).
  private let childId: String?

  init(
    view: SearchRowViewData,
    childRef: EVYRowRef?,
    onSelect: ((EVYJson) -> Void)? = nil
  ) {
    self.view = view
    self.childRef = childRef
    self.onSelect = onSelect
    if case .id(let childId)? = childRef {
      self.childId = childId
      _childTemplate = State(initialValue: EVYRowStore.row(id: childId))
    } else {
      childId = nil
    }
  }

  var body: some View {
    // The title header lives inside EVYSearch so a collapsed search resolves
    // to EmptyView with no intermediate stack absorbing the parent's padding.
    EVYSearch(
      source: view.source,
      destination: view.destination,
      title: view.title,
      placeholder: view.placeholder,
      noResults: view.no_results,
      resultTemplate: childTemplate?.uiRow() ?? childRef?.templateRow(),
      scope: evyScope,
      onSelect: onSelect
    )
    // The source participates so a parent-row source edit also resets identity.
    .id("\(view.source)|\(childTemplateVersion)")
    .onEVYRecordChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.ref,
      id: childId ?? ""
    ) {
      guard let childId else { return }
      // Full syncs re-upsert every row; the equality guard makes those a no-op.
      let latest = EVYRowStore.row(id: childId)
      if childTemplate != latest {
        childTemplate = latest
        childTemplateVersion += 1
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-search-row",
        "type": "search",
        "source": "{items}",
        "destination": "{selected_item}",
        "actions": {},
        "title": "Search preview",
        "placeholder": "Search items...",
        "no_results": "No items match your search",
        "child": {
          "id": "preview-search-result-template",
          "type": "text",
          "actions": {},
          "title": "{$datum.title}",
          "subtitle": "{$datum.category}",
          "icon": "::search::"
        }
      }
      """,
    failureMessage: "Unable to build search row preview"
  ) {
    let previewItemsJSON = """
      [
        { "id": "preview-item-1", "title": "Amazing Fridge", "category": "Kitchen" },
        { "id": "preview-item-2", "title": "Amazing Freezer", "category": "Kitchen" },
        { "id": "preview-item-3", "title": "Vintage Printer", "category": "Office" }
      ]
      """
    if let data = previewItemsJSON.data(using: .utf8),
      let parsed = try? JSONDecoder().decode(EVYJson.self, from: data)
    {
      try? EVY.publicStore.applySyncedValue(
        namespace: EVYNamespace.local, resource: "items", value: parsed)
    }
    EVYPreviewMockData.seedCommon()
  }
}
