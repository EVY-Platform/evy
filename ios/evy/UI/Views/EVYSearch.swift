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
  let value: String
  let resultTemplate: UI_Row?
  let actions: [UI_RowAction]

  init(
    source: String,
    destination: String,
    placeholder: String,
    value: String = "",
    resultTemplate: UI_Row?,
    actions: [UI_RowAction],
  ) {
    self.source = source
    self.destination = destination
    self.placeholder = placeholder
    self.value = value
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
        value: value,
        actions: actions,
      )
    } else {
      EVYSearchSingle(
        source: source,
        resultTemplate: resultTemplate,
        destination: destination,
        placeholder: placeholder,
        value: value,
        actions: actions,
      )
    }
  }
}

struct EVYSearchField: View {
  @Bindable private var placeholderValue: EVYState<EVYValue>
  @Binding private var text: String
  @State private var initialized = false

  let initialValue: String
  let showsLeadingIconOnlyWhenEmpty: Bool
  let showsClearButton: Bool
  let onInitialText: (String) -> Void
  let onTextChange: (String) -> Void
  let onClear: () -> Void

  init(
    placeholder: String,
    value: String = "",
    text: Binding<String>,
    showsLeadingIconOnlyWhenEmpty: Bool = false,
    showsClearButton: Bool = false,
    onInitialText: @escaping (String) -> Void = { _ in },
    onTextChange: @escaping (String) -> Void = { _ in },
    onClear: @escaping () -> Void = {}
  ) {
    self.initialValue = value
    _text = text
    self.showsLeadingIconOnlyWhenEmpty = showsLeadingIconOnlyWhenEmpty
    self.showsClearButton = showsClearButton
    self.onInitialText = onInitialText
    self.onTextChange = onTextChange
    self.onClear = onClear

    let watchTarget = EVY.watchTarget(for: placeholder)
    self.placeholderValue = EVYState(watch: watchTarget) { _ in
      EVYTextResolver.resolveValue(from: placeholder)
    }
  }

  var body: some View {
    HStack {
      if !showsLeadingIconOnlyWhenEmpty || text.isEmpty {
        Image(uiImage: Lucide.search)
          .padding(.leading, Constants.minorPadding)
      }

      TextField(placeholderValue.value.toString(), text: $text)
        .font(.evy)

      if showsClearButton, !text.isEmpty {
        Image(uiImage: Lucide.x)
          .padding(.trailing, Constants.minorPadding)
          .onTapGesture {
            text = ""
            onClear()
          }
      }
    }
    .onAppear {
      guard !initialized else { return }
      initialized = true
      let resolvedValue = EVYTextResolver.resolveValue(from: initialValue).toString()
      guard !resolvedValue.isEmpty else { return }
      text = resolvedValue
      onInitialText(resolvedValue)
    }
    .onChange(of: text) { _, newValue in
      onTextChange(newValue)
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
