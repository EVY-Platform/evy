//
//  EVYSearch.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

private struct EVYSearchResult: Equatable, Identifiable {
  let id: String
  let datum: EVYJson
  let displayRow: UI_Row
  let searchableText: String

  static func == (lhs: EVYSearchResult, rhs: EVYSearchResult) -> Bool {
    lhs.id == rhs.id
  }
}

struct EVYSearch: View {
  let source: String
  let destination: String
  let placeholder: String?
  let resultTemplate: UI_Row?
  let scopeId: String?

  @State private var searchText = ""
  private var results: EVYState<[EVYSearchResult]>

  init(
    source: String, destination: String, placeholder: String?, resultTemplate: UI_Row?,
    scopeId: String? = nil
  ) {
    self.source = source
    self.destination = destination
    self.placeholder = placeholder
    self.resultTemplate = resultTemplate
    self.scopeId = scopeId

    results = EVYState(
      textToWatch: source,
      setter: {
        Self.makeResults(source: source, resultTemplate: resultTemplate, scopeId: scopeId)
      }
    )
  }

  private var filteredResults: [EVYSearchResult] {
    let trimmedSearchText = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedSearchText.isEmpty else {
      return results.value
    }

    return results.value.filter {
      $0.searchableText.localizedCaseInsensitiveContains(trimmedSearchText)
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      EVYSearchField(text: $searchText, placeholder: placeholder)

      ForEach(filteredResults) { result in
        EVYRow(row: result.displayRow, datum: result.datum)
          .padding(.vertical, Constants.majorPadding)
          .contentShape(Rectangle())
          .simultaneousGesture(
            TapGesture().onEnded {
              guard !destination.isEmpty else { return }
              try? EVY.writeRawValue(result.datum, to: destination)
            }
          )
      }
    }
  }

  private static func makeResults(source: String, resultTemplate: UI_Row?, scopeId: String?)
    -> [EVYSearchResult]
  {
    guard let resultTemplate else {
      return []
    }

    do {
      let previous = EVY.activeCacheScopeId
      EVY.activeCacheScopeId = scopeId
      defer { EVY.activeCacheScopeId = previous }
      let sourceData = try EVY.getDataFromText(source)
      let dataRows: [EVYJson]
      if case .array(let arrayValue) = sourceData {
        dataRows = arrayValue
      } else {
        dataRows = [sourceData]
      }

      let formatter = try EVYDatumRowFormatter(template: resultTemplate)
      return dataRows.compactMap { datum in
        guard let (displayRow, searchableValues) = try? formatter.formattedResult(datum: datum)
        else {
          return nil
        }
        let id = datum.identifierValue()
        let searchableText = searchableValues.joined(separator: " ")
        return EVYSearchResult(
          id: id,
          datum: datum,
          displayRow: displayRow,
          searchableText: searchableText
        )
      }
    } catch {
      return []
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
