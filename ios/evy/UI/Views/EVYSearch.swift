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
  let title: String
}

private struct EVYSearchResultRow: Identifiable {
  let id: String
  let result: EVYSearchResult
}

struct EVYSearch: View {
  @Environment(\.navigate) private var navigate

  let source: String
  let placeholder: String
  let resultTemplate: UI_Row?

  @State private var allResults: [EVYSearchResultRow] = []
  @State private var searchText = ""

  init(
    source: String,
    placeholder: String,
    resultTemplate: UI_Row?
  ) {
    self.source = source
    self.placeholder = placeholder
    self.resultTemplate = resultTemplate
  }

  private var filteredResults: [EVYSearchResultRow] {
    let trimmedSearchText = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedSearchText.isEmpty else {
      return allResults
    }

    return allResults.filter {
      $0.result.title.localizedCaseInsensitiveContains(trimmedSearchText)
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      EVYSearchField(text: $searchText, placeholder: placeholder)

      List(filteredResults) { resultRow in
        EVYRow(row: resultRow.result.displayRow)
          .contentShape(Rectangle())
          .onTapGesture {
            EVYActionRunner.run(
              actions: resultRow.result.displayRow.actions,
              datum: resultRow.result.datum,
              navigate: navigate
            )
          }
          .listRowInsets(EdgeInsets())
      }
      .listStyle(.plain)
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
        guard let displayRow = try? formatter.formattedResult(datum: datum).row else {
          return nil
        }
        let id = datum.identifierValue()
        let title = datum.parseProp(props: ["title"]).toString()
        return EVYSearchResultRow(
          id: id,
          result: EVYSearchResult(
            id: id,
            datum: datum,
            displayRow: displayRow,
            title: title
          )
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
        { "id": "preview-item-1", "title": "Amazing Fridge" },
        { "id": "preview-item-2", "title": "Amazing Freezer" },
        { "id": "preview-item-3", "title": "Vintage Printer" }
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
            "subtitle": "",
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
