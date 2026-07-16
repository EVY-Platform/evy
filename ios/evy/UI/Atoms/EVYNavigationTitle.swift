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
    let _ = titleState.value

    content
      .navigationTitle("")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        if !template.isEmpty {
          ToolbarItem(placement: .principal) {
            Group {
              if let accessibilityIdentifier {
                EVYTextView(state: titleState, style: .title)
                  .lineLimit(1)
                  .truncationMode(.tail)
                  .accessibilityIdentifier(accessibilityIdentifier)
              } else {
                EVYTextView(state: titleState, style: .title)
                  .lineLimit(1)
                  .truncationMode(.tail)
              }
            }
          }
        }
      }
      .onChange(of: template) { _, newTemplate in
        titleState = EVYTextView.makeState(template: newTemplate)
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
