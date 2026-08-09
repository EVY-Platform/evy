//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRow: View {

  private let view: SearchRowViewData
  private let variantRefs: [EVYRowRef]
  private let onSelect: ((EVYJson) -> Void)?

  @Environment(\.evyScope) private var evyScope

  // EVYSearch captures its source and result template in State(initialValue:)
  // closures, which SwiftUI never re-runs for the same view identity. Editing
  // a variant template row (its own evy.rows record - nothing else observes
  // it) bumps the version, and the version keys EVYSearch's identity so a
  // fresh init picks up the changed template.
  @State private var storedTemplates: [String: EVYStoredRow?]
  @State private var templateVersion = 0

  private let watchedVariantIds: Set<String>

  init(
    view: SearchRowViewData,
    variantRefs: [EVYRowRef],
    onSelect: ((EVYJson) -> Void)? = nil
  ) {
    self.view = view
    self.variantRefs = variantRefs
    self.onSelect = onSelect
    let storedIds = variantRefs.compactMap { ref -> String? in
      if case .id(let id) = ref { return id }
      return nil
    }
    watchedVariantIds = Set(storedIds)
    var initialTemplates: [String: EVYStoredRow?] = [:]
    for id in storedIds {
      initialTemplates[id] = EVYRowStore.row(id: id)
    }
    _storedTemplates = State(initialValue: initialTemplates)
  }

  private var resultTemplates: [UI_Row] {
    variantRefs.compactMap { ref in
      switch ref {
      case .id(let id):
        guard let stored = storedTemplates[id] else { return nil }
        return stored?.uiRow()
      case .inline(let row):
        return row
      }
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
      resultTemplates: resultTemplates,
      scope: evyScope,
      onSelect: onSelect
    )
    // The source participates so a parent-row source edit also resets identity.
    .id("\(view.source)|\(templateVersion)")
    .onEVYRecordChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.ref,
      ids: watchedVariantIds
    ) {
      var latest = storedTemplates
      for id in watchedVariantIds {
        latest[id] = EVYRowStore.row(id: id)
      }
      if latest != storedTemplates {
        storedTemplates = latest
        templateVersion += 1
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
        "children": [
          {
            "id": "preview-search-result-template",
            "type": "text",
            "actions": {},
            "title": "{$datum.title}",
            "subtitle": "{$datum.category}",
            "icon": "::search::",
            "visible": "true"
          }
        ]
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
