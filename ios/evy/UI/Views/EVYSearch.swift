//
//  EVYSearch.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import LucideIcons
import SwiftUI

struct EVYSearch: View {
  private let canSelectMultiple: Bool

  let source: String
  let destination: String
  let placeholder: String
  let resultTemplate: UI_Row?
  let actions: [UI_RowAction]

  init(
    source: String,
    destination: String,
    placeholder: String,
    resultTemplate: UI_Row?,
    actions: [UI_RowAction],
  ) {
    self.source = source
    self.destination = destination
    self.placeholder = placeholder
    self.resultTemplate = resultTemplate
    self.actions = actions

    do {
      let data = try EVY.getDataFromText(destination)
      if case .array = data {
        canSelectMultiple = true
      } else {
        canSelectMultiple = false
      }
    } catch {
      canSelectMultiple = false
    }
  }

  var body: some View {
    if canSelectMultiple {
      EVYSearchMultiple(
        source: source,
        resultTemplate: resultTemplate,
        destination: destination,
        placeholder: placeholder,
        actions: actions,
      )
    } else {
      EVYSearchSingle(
        source: source,
        resultTemplate: resultTemplate,
        destination: destination,
        placeholder: placeholder,
        actions: actions,
      )
    }
  }
}

struct EVYSearchField: View {
  let placeholder: String
  @Binding var text: String
  let showsLeadingIconWhenEmpty: Bool
  let showsClearButton: Bool
  let onClear: () -> Void

  init(
    placeholder: String,
    text: Binding<String>,
    showsLeadingIconWhenEmpty: Bool = false,
    showsClearButton: Bool = false,
    onClear: @escaping () -> Void = {}
  ) {
    self.placeholder = placeholder
    _text = text
    self.showsLeadingIconWhenEmpty = showsLeadingIconWhenEmpty
    self.showsClearButton = showsClearButton
    self.onClear = onClear
  }

  var body: some View {
    HStack {
      if !showsLeadingIconWhenEmpty || text.isEmpty {
        Image(uiImage: Lucide.search)
          .padding(.leading, Constants.minorPadding)
      }

      TextField(placeholder, text: $text)
        .font(.evy)

      if showsClearButton, !text.isEmpty {
        Image(uiImage: Lucide.x)
          .padding(.trailing, Constants.minorPadding)
          .onTapGesture { onClear() }
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
  }
}

struct EVYSearchResultsList: View {
  let results: [EVYSearchResult]
  let onSelect: (EVYSearchResult) -> Void

  var body: some View {
    LazyVStack(spacing: 20) {
      ForEach(results, id: \.value) { result in
        EVYRow(row: result.displayRow)
          .onTapGesture { onSelect(result) }
      }
    }
  }
}
