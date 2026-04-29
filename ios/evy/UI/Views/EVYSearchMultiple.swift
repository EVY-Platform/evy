//
//  EVYSearchMultiple.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/9/2024.
//

import SwiftUI

struct EVYSearchMultiple: View {
  @Environment(\.navigate) private var navigate

  @State private var selected: [EVYSearchResult] = []
  @State private var searchFieldValue = ""

  @StateObject private var searchController: EVYSearchController

  let source: String
  let destination: String
  let placeholder: String
  let resultTemplate: UI_Row?
  let actions: [UI_RowAction]

  init(
    source: String,
    resultTemplate: UI_Row?,
    destination: String,
    placeholder: String,
    actions: [UI_RowAction],
  ) {
    self.source = source
    self.resultTemplate = resultTemplate
    self.destination = destination
    self.placeholder = placeholder
    self.actions = actions

    _searchController = StateObject(
      wrappedValue: EVYSearchController(source: source, resultTemplate: resultTemplate)
    )
  }

  func refresh() {
    guard resultTemplate != nil, !destination.isEmpty else {
      return
    }
    do {
      let existingData = try EVY.getDataFromText(destination)
      guard case .array(let arrayValue) = existingData else {
        return
      }

      var seenValues = Set(selected.map(\.value))
      var next = selected
      next.reserveCapacity(selected.count + arrayValue.count)
      for value in arrayValue {
        let result = try searchController.makeSearchResult(datum: value)
        if seenValues.insert(result.value).inserted {
          next.append(result)
        }
      }
      selected = next
    } catch {
      #if DEBUG
        print("[EVYSearchMultiple] Error refreshing data: \(error)")
      #endif
    }
  }

  func select(_ element: EVYSearchResult) {
    selected.append(element)

    if !destination.isEmpty {
      do {
        let encoded = try JSONEncoder().encode(selected.map { $0.data })
        try EVY.updateData(encoded, at: destination)
      } catch {
        selected.removeAll { $0.value == element.value }
      }
    }

    if selected.contains(where: { $0.value == element.value }) {
      searchController.results.removeAll { $0.value == element.value }
    }

    if !actions.isEmpty {
      EVYActionRunner.run(actions: actions, datum: element.data, navigate: navigate)
    }
  }

  func unselect(_ element: EVYSearchResult) {
    selected.removeAll { $0.value == element.value }

    guard !destination.isEmpty else {
      return
    }

    do {
      try EVY.updateData(
        try JSONEncoder().encode(selected.map { $0.data }),
        at: destination)
    } catch {
      searchController.results.removeAll { $0.value == element.value }
    }
  }

  var body: some View {
    VStack {
      EVYSearchField(
        placeholder: placeholder,
        text: $searchFieldValue
      )
      .padding(.horizontal, Constants.majorPadding)
      .onChange(of: searchFieldValue) { _, newValue in
        searchController.debouncedSearch(name: newValue)
      }

      if selected.count > 0 {
        ScrollView(
          .horizontal,
          content: {
            HStack {
              ForEach(selected.reversed(), id: \.value) { result in
                EVYRectangle.fitWidth(
                  content: EVYTextView(result.value),
                  style: .primary
                )
                .onTapGesture { unselect(result) }
              }
            }
            .offset(x: Constants.majorPadding)
          }
        )
        .scrollIndicators(.hidden)
      }

      EVYSearchResultsList(results: searchController.results) { result in
        select(result)
      }
      .onChange(of: searchController.results) { _, _ in
        searchController.results.removeAll { r in
          selected.contains { $0.value == r.value }
        }
      }
    }
    .onAppear { refresh() }
  }
}

#Preview {
  AsyncPreview { asyncView in
    asyncView
  } view: {
    try! await EVYPreviewFixtures.seedData()

    return EVYSearch(
      source: "{$api:tags}",
      destination: "{tags}",
      placeholder: "Search",
      resultTemplate: nil,
      actions: [],
    )
  }
}
