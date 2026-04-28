//
//  EVYSearchSingle.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/9/2024.
//

import LucideIcons
import SwiftUI

struct EVYSearchSingle: View {
  @State private var selected: String = ""
  @State private var value: String = ""

  @ObservedObject private var searchController: EVYSearchController

  let destination: String
  let placeholder: String

  init(
    source: String,
    resultTemplate: UI_Row?,
    destination: String,
    placeholder: String,
  ) {
    self.destination = destination
    self.placeholder = placeholder

    searchController = EVYSearchController(source: source, resultTemplate: resultTemplate)
  }

  func select(_ element: EVYSearchResult) {
    do {
      value = element.value
      selected = element.value
      let encoded = try JSONEncoder().encode(element.data)
      try EVY.updateData(encoded, at: destination)
    } catch {
      #if DEBUG
        print("[EVYSearchSingle] Error selecting element: \(error)")
      #endif
    }
  }

  func unselect() {
    do {
      value = ""
      selected = ""
      try EVY.updateValue("{}", at: destination)
    } catch {
      #if DEBUG
        print("[EVYSearchSingle] Error unselecting: \(error)")
      #endif
    }
  }

  var body: some View {
    VStack {
      // Search bar
      HStack {
        if value.isEmpty {
          Image(uiImage: Lucide.search)
            .padding(.leading, Constants.minorPadding)
        }

        TextField(placeholder, text: $value)
          .font(.evy)

        if !value.isEmpty {
          Image(uiImage: Lucide.x)
            .padding(.trailing, Constants.minorPadding)
            .onTapGesture { unselect() }
        }
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
      .onChange(of: value) { _, newValue in
        if newValue == selected {
          return
        }

        searchController.debouncedSearch(name: newValue)
      }

      // Search results
      LazyVStack(spacing: 20) {
        ForEach(searchController.results, id: \.value) { result in
          EVYRow(row: result.displayRow)
            .onTapGesture { select(result) }
        }
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
      resultTemplate: template
    )
  }
}
