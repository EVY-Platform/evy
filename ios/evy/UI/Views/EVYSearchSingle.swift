//
//  EVYSearchSingle.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/9/2024.
//

import SwiftUI

struct EVYSearchSingle: View {
  @Environment(\.navigate) private var navigate

  @State private var selected: String = ""
  @State private var value: String = ""

  @StateObject private var searchController: EVYSearchController

  let destination: String
  let placeholder: String
  let initialValue: String
  let actions: [UI_RowAction]

  init(
    source: String,
    resultTemplate: UI_Row?,
    destination: String,
    placeholder: String,
    value: String = "",
    actions: [UI_RowAction],
  ) {
    self.destination = destination
    self.placeholder = placeholder
    self.initialValue = value
    self.actions = actions

    _searchController = StateObject(
      wrappedValue: EVYSearchController(source: source, resultTemplate: resultTemplate)
    )
  }

  func select(_ element: EVYSearchResult) {
    value = element.value
    selected = element.value

    if !destination.isEmpty {
      do {
        let encoded = try JSONEncoder().encode(element.data)
        try EVY.updateData(encoded, at: destination)
      } catch {
        #if DEBUG
          print("[EVYSearchSingle] Error updating selected element: \(error)")
        #endif
      }
    }

    if !actions.isEmpty {
      EVYActionRunner.run(actions: actions, datum: element.data, navigate: navigate)
    }
  }

  func unselect() {
    value = ""
    selected = ""

    guard !destination.isEmpty else {
      return
    }

    do {
      try EVY.updateValue("{}", at: destination)
    } catch {
      #if DEBUG
        print("[EVYSearchSingle] Error unselecting: \(error)")
      #endif
    }
  }

  var body: some View {
    VStack {
      EVYSearchField(
        placeholder: placeholder,
        value: initialValue,
        text: $value,
        showsLeadingIconOnlyWhenEmpty: true,
        showsClearButton: true,
        onInitialText: { initialValue in
          Task { await searchController.search(name: initialValue) }
        },
        onTextChange: { newValue in
          if newValue == selected {
            return
          }
          searchController.debouncedSearch(name: newValue)
        },
        onClear: unselect
      )

      EVYSearchResultsList(results: searchController.results) { result in
        select(result)
      }
    }

  }
}

#Preview {
  AsyncPreview { (asyncView: EVYSearch) in
    asyncView
  } view: {
    // Local-only: no EVY.getRow / EVYAPIManager (avoids API_HOST fatalError in Xcode canvas).
    if !EVY.publicStore.exists(key: "tags") {
      try EVY.publicStore.create(key: "tags", data: Data("[]".utf8))
    }
    let templateJson = """
      {
      	"id": "preview-search-row",
      	"type": "Info",
      	"source": "",
      	"destination": "",
      	"actions": [],
      	"view": {
      		"content": {
      			"title": "{$datum:unit} {$datum:street}",
      			"subtitle": "{$datum:city} {$datum:state} {$datum:postcode}",
      			"icon": ""
      		}
      	}
      }
      """
    let template = try JSONDecoder().decode(
      UI_Row.self,
      from: Data(templateJson.utf8),
    )
    return EVYSearch(
      source: "{$local:address}",
      destination: "",
      placeholder: "Search",
      resultTemplate: template,
      actions: []
    )
  }
}
