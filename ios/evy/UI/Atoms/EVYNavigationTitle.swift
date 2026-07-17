//
//  EVYNavigationTitle.swift
//  evy
//

import SwiftUI

struct EVYNavigationTitle: ViewModifier {
  let template: String
  let accessibilityIdentifier: String?

  @State private var titleState: EVYState<EVYValue>

  init(template: String, accessibilityIdentifier: String? = nil) {
    self.template = template
    self.accessibilityIdentifier = accessibilityIdentifier
    _titleState = State(initialValue: EVYTextView.makeState(template: template))
  }

  func body(content: Content) -> some View {
    // Read the resolved value so this modifier body re-evaluates when the watched
    // data changes, and key the principal item on it: SwiftUI does not re-render a
    // toolbar-hosted view on an @Observable change alone, so the changing `.id`
    // remounts it with the current value.
    let resolved = titleState.value.toString()

    content
      .navigationTitle("")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        if !template.isEmpty {
          ToolbarItem(placement: .principal) {
            titlePrincipalLabel()
              .id(resolved)
          }
        }
      }
      .onChange(of: template) { _, newTemplate in
        titleState = EVYTextView.makeState(template: newTemplate)
      }
  }

  @ViewBuilder
  private func titlePrincipalLabel() -> some View {
    let label = EVYTextView(state: titleState, style: .title)
      .lineLimit(1)
      .truncationMode(.tail)
    if let accessibilityIdentifier {
      label.accessibilityIdentifier(accessibilityIdentifier)
    } else {
      label
    }
  }
}

extension View {
  func evyNavigationTitle(
    _ template: String,
    accessibilityIdentifier: String? = nil
  ) -> some View {
    modifier(
      EVYNavigationTitle(template: template, accessibilityIdentifier: accessibilityIdentifier))
  }
}
