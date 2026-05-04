//
//  EVYSearch.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

private struct EVYSearchResult: Identifiable {
  let id: String
  let datum: EVYJson
  let displayRow: UI_Row
  let searchableText: String
}

struct EVYSearch: View {
  @Environment(\.navigate) private var navigate

  let source: String
  let placeholder: String
  let resultTemplate: UI_Row?

  @State private var allResults: [EVYSearchResult] = []
  @State private var searchText = ""

  private var filteredResults: [EVYSearchResult] {
    let trimmedSearchText = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedSearchText.isEmpty else {
      return allResults
    }

    return allResults.filter {
      $0.searchableText.localizedCaseInsensitiveContains(trimmedSearchText)
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      EVYSearchField(text: $searchText, placeholder: placeholder)

      ForEach(filteredResults) { result in
        EVYRow(row: result.displayRow)
          .onTapGesture {
            EVYActionRunner.run(
              actions: result.displayRow.actions,
              datum: result.datum,
              navigate: navigate
            )
          }
          .padding(.vertical, Constants.majorPadding)
      }
    }
    .onAppear(perform: loadResults)
    .onChange(of: source) { _, _ in
      loadResults()
    }
  }

  private func loadResults() {
    guard let resultTemplate else {
      allResults = []
      return
    }

    do {
      let sourceData = try EVY.getDataFromText(source)
      let dataRows: [EVYJson]
      if case .array(let arrayValue) = sourceData {
        dataRows = arrayValue
      } else {
        dataRows = [sourceData]
      }

      let formatter = try EVYDatumRowFormatter(template: resultTemplate)
      allResults = dataRows.compactMap { datum in
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
      allResults = []
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

    if let previewItemsData = previewItemsJSON.data(using: .utf8) {
      try? EVY.publicStore.upsert(key: "items", value: previewItemsData)
    }
  }

  var body: some View {
    EVYSearch(
      source: "{items}",
      placeholder: "Search items...",
      resultTemplate: resultTemplate
    )
  }

  private static func makeResultTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "preview-search-result-template",
        "type": "Info",
        "source": "",
        "destination": "",
        "actions": [],
        "view": {
          "content": {
            "title": "{$datum:title}",
            "subtitle": "{$datum:category}",
            "icon": ""
          }
        }
      }
      """

    guard let resultTemplateData = resultTemplateJSON.data(using: .utf8) else {
      return nil
    }

    return try? JSONDecoder().decode(UI_Row.self, from: resultTemplateData)
  }
}
