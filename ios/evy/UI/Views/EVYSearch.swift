//
//  EVYSearch.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearch: View {
  let destination: String
  let placeholder: String?
  let noResults: String?
  let scope: EVYScope
  let onSelect: ((EVYJson) -> Void)?

  @Environment(\.dismiss) private var dismiss
  @State private var searchText = ""
  @State private var apiSearchModel: EVYSearchModel?
  @State private var localResults: EVYState<[EVYSearchResult]>?

  private let searchSource: EVY.SourceExpression

  private static let debounceMilliseconds = 300

  init(
    source: String, destination: String, placeholder: String?, noResults: String? = nil,
    resultTemplate: UI_Row?,
    scope: EVYScope = .empty,
    onSelect: ((EVYJson) -> Void)? = nil
  ) {
    self.destination = destination
    self.placeholder = placeholder
    self.noResults = noResults
    self.scope = scope
    self.onSelect = onSelect
    searchSource = EVY.classifySource(source)

    switch searchSource {
    case .local:
      _localResults = State(
        initialValue: EVYState(
          textToWatch: source,
          scope: scope,
          setter: {
            EVYSearchResult.loadLocalResults(
              source: source,
              resultTemplate: resultTemplate,
              scopeId: scope.cacheScopeId
            )
          }
        )
      )
    case .api(let method):
      _localResults = State(initialValue: nil)
      _apiSearchModel = State(
        initialValue: EVYSearchModel(
          method: method,
          resultTemplate: resultTemplate,
          scopeId: scope.cacheScopeId
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
      return localResults?.value ?? []
    }

    return (localResults?.value ?? []).filter {
      $0.searchableText.localizedCaseInsensitiveContains(trimmedSearchText)
    }
  }

  /// True only for API sources — local filtering is synchronous, so there is nothing to await.
  private var isSearching: Bool {
    guard case .api = searchSource else { return false }
    return apiSearchModel?.isSearching == true
  }

  private var shouldShowNoResults: Bool {
    let trimmedNoResults = (noResults ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedNoResults.isEmpty, !isSearching, displayedResults.isEmpty else {
      return false
    }

    switch searchSource {
    case .api:
      return apiSearchModel?.hasSearched == true
    case .local:
      if isListOnly {
        return true
      }
      return !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
  }

  /// Blank/absent placeholder means the Search is a filtered list, not a query box.
  private var isListOnly: Bool {
    (placeholder ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  var body: some View {
    VStack(spacing: 0) {
      if !isListOnly {
        EVYTextInput(
          text: $searchText,
          placeholder: placeholder.map { "::search:: \($0)" }
        )
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
      }

      if isSearching {
        ProgressView()
          .progressViewStyle(.circular)
          .padding(.vertical, Constants.majorPadding)
          .accessibilityIdentifier("searchLoadingIndicator")
      } else if shouldShowNoResults {
        EVYTextView(noResults ?? "", style: .info)
          .padding(.vertical, Constants.majorPadding)
          .accessibilityIdentifier("searchNoResults")
      } else {
        ForEach(displayedResults) { result in
          EVYRow(row: result.displayRow, datum: result.datum)
            .padding(.vertical, Constants.majorPadding)
            .contentShape(Rectangle())
            .simultaneousGesture(
              TapGesture().onEnded {
                selectResult(result.datum)
              }
            )
        }
      }
    }
    .task(id: searchText) {
      guard case .api = searchSource else { return }
      let trimmedQuery = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !trimmedQuery.isEmpty else {
        apiSearchModel?.clearResults()
        return
      }
      try? await Task.sleep(for: .milliseconds(Self.debounceMilliseconds))
      guard !Task.isCancelled else { return }
      await apiSearchModel?.search(query: trimmedQuery)
    }
  }

  private func selectResult(_ datum: EVYJson) {
    guard !destination.isEmpty else { return }
    do {
      try EVY.writeRawValue(
        EVY.searchDestinationValue(from: datum, destination: destination),
        to: destination,
        scopeId: scope.draftScopeId
      )
      onSelect?(datum)
      dismiss()
    } catch {
      // Invalid destination writes are non-fatal here.
    }
  }
}

extension EVY {
  /// Value written when a Search result is selected: strips external `id` (e.g. Google place
  /// id) and preserves keys already on the destination draft that the selection omits
  /// (e.g. instructions).
  static func searchDestinationValue(from datum: EVYJson, destination: String) -> EVYJson {
    guard case .dictionary(var fields) = datum else { return datum }
    fields.removeValue(forKey: "id")
    if let existing = try? getDataFromText(destination),
      case .dictionary(let existingFields) = existing
    {
      for (key, value) in existingFields where fields[key] == nil {
        fields[key] = value
      }
    }
    return .dictionary(fields)
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
        "type": "text",
        "actions": {},
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
