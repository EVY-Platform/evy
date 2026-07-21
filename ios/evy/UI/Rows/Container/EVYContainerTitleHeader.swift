//
//  EVYContainerTitleHeader.swift
//  evy
//

import SwiftUI

/// Wraps row content in a leading `VStack` with an optional title header.
/// `padsContent` pads the whole stack horizontally (edit/view rows);
/// otherwise only the title is padded (container children pad themselves).
private struct EVYTitledRow: ViewModifier {
  let title: String?
  let spacing: CGFloat?
  let padsContent: Bool

  func body(content: Content) -> some View {
    VStack(alignment: .leading, spacing: spacing) {
      if let title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
          .padding(.horizontal, padsContent ? 0 : Constants.majorPadding)
      }
      content
    }
    .padding(.horizontal, padsContent ? Constants.majorPadding : 0)
  }
}

extension View {
  func containerTitleHeader(_ title: String?) -> some View {
    modifier(EVYTitledRow(title: title, spacing: nil, padsContent: false))
  }

  func titledRow(_ title: String?, spacing: CGFloat? = nil) -> some View {
    modifier(EVYTitledRow(title: title, spacing: spacing, padsContent: true))
  }
}
