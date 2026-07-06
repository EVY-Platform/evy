//
//  EVYSearch.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearch: View {
  let source: String
  let destination: String
  let placeholder: String?
  let resultTemplate: UI_Row?
  let scopeId: String?
  let draftScopeId: String?

  @Environment(\.dismiss) private var dismiss
  @State private var searchText = ""
  @State private var apiSearchModel: EVYSearchModel?

  private let searchSource: EVYSearchSource
  private var localResults: EVYState<[EVYSearchResult]>

  init(
    source: String, destination: String, placeholder: String?, resultTemplate: UI_Row?,
    scopeId: String? = nil,
    draftScopeId: String? = nil
  ) {
    self.source = source
    self.destination = destination
    self.placeholder = placeholder
    self.resultTemplate = resultTemplate
    self.scopeId = scopeId
    self.draftScopeId = draftScopeId
    searchSource = EVYSearchSource.parse(source)

    switch searchSource {
    case .local:
      localResults = EVYState(
        textToWatch: source,
        setter: {
          EVYSearchResult.makeResults(
            from: try? EVY.getDataFromText(source),
            resultTemplate: resultTemplate,
            scopeId: scopeId
          )
        }
      )
      _apiSearchModel = State(initialValue: nil)
    case .api(let method):
      localResults = EVYState(textToWatch: "", setter: { [] })
      _apiSearchModel = State(
        initialValue: EVYSearchModel(
          method: method,
          resultTemplate: resultTemplate,
          scopeId: scopeId
        )
      )
    }
  }

  private var displayedResults: [EVYSearchResult] {
    switch searchSource {
    case .api:
      return apiSearchModel?.results ?? []
    case .local:
      return filteredLocalResults
    }
  }

  private var filteredLocalResults: [EVYSearchResult] {
    let trimmedSearchText = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedSearchText.isEmpty else {
      return localResults.value
    }

    return localResults.value.filter {
      $0.searchableText.localizedCaseInsensitiveContains(trimmedSearchText)
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      EVYSearchField(text: $searchText, placeholder: placeholder)

      ForEach(displayedResults) { result in
        EVYRow(row: result.displayRow, datum: result.datum)
          .padding(.vertical, Constants.majorPadding)
          .contentShape(Rectangle())
          .simultaneousGesture(
            TapGesture().onEnded {
              guard !destination.isEmpty else { return }
              do {
                try EVY.writeRawValue(
                  result.datum, to: destination, scopeId: draftScopeId)
                dismiss()
              } catch {
                // Match prior silent-failure behaviour for invalid writes.
              }
            }
          )
      }
    }
    .task(id: searchText) {
      guard case .api = searchSource else { return }
      let trimmedQuery = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !trimmedQuery.isEmpty else {
        apiSearchModel?.clearResults()
        return
      }
      try? await Task.sleep(for: .milliseconds(EVYSearchModel.debounceMilliseconds))
      guard !Task.isCancelled else { return }
      await apiSearchModel?.search(query: trimmedQuery)
    }
  }
}

#Preview {
  EVYSearchPreview()
}

private struct EVYSearchPreview: View {
  private let resultTemplate = EVYSearchPreview.makeResultTemplate()

  init() {
    let previewItemsJSON = """
      [
        { "id": "preview-item-1", "title": "Amazing Fridge", "category": "Kitchen" },
        { "id": "preview-item-2", "title": "Amazing Freezer", "category": "Kitchen" },
        { "id": "preview-item-3", "title": "Vintage Printer", "category": "Office" }
      ]
      """

    if let previewItemsData = previewItemsJSON.data(using: .utf8),
      let parsed = try? JSONDecoder().decode(EVYJson.self, from: previewItemsData)
    {
      try? EVY.publicStore.applySyncedValue(
        namespace: EVYNamespace.local, resource: "items", value: parsed)
    }
  }

  var body: some View {
    EVYSearch(
      source: "{items}",
      destination: "{selected_item}",
      placeholder: "Search items...",
      resultTemplate: resultTemplate
    )
  }

  private static func makeResultTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "preview-search-result-template",
        "type": "Text",
        "actions": [],
        "title": "{$datum.title}",
        "subtitle": "{$datum.category}",
        "icon": ""
      }
      """

    guard let resultTemplateData = resultTemplateJSON.data(using: .utf8) else {
      return nil
    }

    return try? JSONDecoder().decode(UI_Row.self, from: resultTemplateData)
  }
}
