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

/// Optional title header plus horizontal padding for edit/view rows.
private struct EVYTitledRow: ViewModifier {
  let title: String?
  let spacing: CGFloat?

  func body(content: Content) -> some View {
    VStack(alignment: .leading, spacing: spacing) {
      if let title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      content
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

extension View {
  func containerTitleHeader(_ title: String?) -> some View {
    modifier(EVYContainerTitleHeader(title: title))
  }

  func titledRow(_ title: String?, spacing: CGFloat? = nil) -> some View {
    modifier(EVYTitledRow(title: title, spacing: spacing))
  }
}
