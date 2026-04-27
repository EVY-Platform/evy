//
//  EVYInfoRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYInfoRow: View, EVYRowProtocol {
  public static let JSONType = "Info"

  private static let leadingIconMinWidth: CGFloat = 32

  private let view: InfoRowViewData

  init(view: InfoRowViewData) {
    self.view = view
  }

  var body: some View {
    let content = view.content
    let hasTitle = !content.title.isEmpty
    let hasSubtitle = !content.subtitle.isEmpty
    let icon = content.icon.trimmingCharacters(in: .whitespacesAndNewlines)
    let showIcon = !icon.isEmpty

    HStack(alignment: .top, spacing: Constants.minorPadding) {
      if showIcon {
        EVYTextView(icon, style: .body)
          .frame(minWidth: Self.leadingIconMinWidth, alignment: .center)
      }
      infoTextColumn(content: content, hasTitle: hasTitle, hasSubtitle: hasSubtitle)
    }
    .infoRowOuterWidth(expands: !hasTitle)
    .padding(Constants.minorPadding)
  }

  @ViewBuilder
  private func infoTextColumn(content: InfoRowContent, hasTitle: Bool, hasSubtitle: Bool)
    -> some View
  {
    VStack(alignment: hasTitle && hasSubtitle ? .leading : .center, spacing: 0) {
      if hasTitle {
        EVYTextView(content.title)
          .frame(maxWidth: .infinity, alignment: .leading)
          .lineLimit(1)
          .truncationMode(.tail)
      }
      if hasSubtitle {
        EVYTextView(content.subtitle, style: .info)
          .frame(
            maxWidth: .infinity,
            alignment: hasTitle && hasSubtitle ? .leading : .center
          )
          .lineLimit(3)
          .truncationMode(.tail)
      }
    }
    .frame(
      maxWidth: .infinity,
      alignment: hasTitle && hasSubtitle ? .leading : .center)
  }
}

extension View {
  @ViewBuilder
  fileprivate func infoRowOuterWidth(expands: Bool) -> some View {
    if expands {
      frame(maxWidth: .infinity)
    } else {
      self
    }
  }
}

#Preview {
  AsyncPreview { asyncView in
    EVYRow(row: asyncView)
  } view: {
    try! await EVY.getRow(["2", "pages", "4", "rows", "0"])
  }
}
