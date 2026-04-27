//
//  EVYSearchMultiple.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/9/2024.
//

import LucideIcons
import SwiftUI

struct EVYSearchMultiple: View {
  @State private var selected: [EVYSearchResult] = []
  @State private var searchFieldValue = ""
  @ObservedObject private var searchController: EVYSearchController

  let source: String
  let destination: String
  let placeholder: String
  let resultTemplate: UI_Row?

  init(
    source: String,
    resultTemplate: UI_Row?,
    destination: String,
    placeholder: String,
  ) {
    self.source = source
    self.resultTemplate = resultTemplate
    self.destination = destination
    self.placeholder = placeholder

    searchController = EVYSearchController(source: source, resultTemplate: resultTemplate)
  }

  func refresh() {
    guard resultTemplate != nil else {
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
    do {
      selected.append(element)

      let encoded = try JSONEncoder().encode(selected.map { $0.data })
      try EVY.updateData(encoded, at: destination)
      searchController.results.removeAll { $0.value == element.value }
    } catch {
      selected.removeAll { $0.value == element.value }
    }
  }

  func unselect(_ element: EVYSearchResult) {
    do {
      selected.removeAll { $0.value == element.value }
      try EVY.updateData(
        try JSONEncoder().encode(selected.map { $0.data }),
        at: destination)
    } catch {
      searchController.results.removeAll { $0.value == element.value }
    }
  }

  var body: some View {
    VStack {
      HStack {
        Image(uiImage: Lucide.search)
          .padding(.leading, Constants.minorPadding)
        TextField(placeholder, text: $searchFieldValue).font(.evy)
      }
      .padding(
        EdgeInsets(
          top: Constants.fieldPadding,
          leading: Constants.minorPadding,
          bottom: Constants.fieldPadding,
          trailing: Constants.minorPadding,
        )
      )
      .background(
        RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
          .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth)
          .opacity(Constants.borderOpacity)
      )
      .contentShape(Rectangle())
      .padding(.horizontal, Constants.majorPadding)
      .onChange(of: searchFieldValue) { _, newValue in
        Task(operation: {
          if !newValue.isEmpty && newValue.count > 3 {
            await searchController.search(name: newValue)
          } else {
            searchController.results.removeAll()
          }
        })
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

      List {
        ForEach(searchController.results, id: \.value) { result in
          EVYRow(row: result.displayRow)
            .onTapGesture { select(result) }
        }
        .onChange(of: searchController.results) { _, _ in
          searchController.results.removeAll { r in
            selected.contains { $0.value == r.value }
          }
        }
      }
      .listStyle(.plain)
      .listRowSpacing(20)
      .scrollContentBackground(.hidden)
      .background(Color.white)
    }
    .onAppear { refresh() }
  }
}

#Preview {
  AsyncPreview { asyncView in
    asyncView
  } view: {
    try! await EVY.createItem()

    return EVYSearch(
      source: "{$api:tags}",
      destination: "{tags}",
      placeholder: "Search",
      resultTemplate: nil,
    )
  }
}
