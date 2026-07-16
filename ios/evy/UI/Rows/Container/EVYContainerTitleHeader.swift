//
//  EVYContainerTitleHeader.swift
//  evy
//

import SwiftUI

/// Wraps a container row's content in a leading `VStack` with its optional title header.
private struct EVYContainerTitleHeader: ViewModifier {
  let title: String?

  func body(content: Content) -> some View {
    VStack(alignment: .leading) {
      if let title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
          .padding(.horizontal, Constants.majorPadding)
      }
      content
    }
  }
}

extension View {
  func containerTitleHeader(_ title: String?) -> some View {
    modifier(EVYContainerTitleHeader(title: title))
  }
}
