//
//  EVYInfoRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYInfoRow: View {

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

    HStack(alignment: .top) {
      if showIcon {
        EVYTextView(icon, style: .body)
      }
      infoTextColumn(content: content, hasTitle: hasTitle, hasSubtitle: hasSubtitle)
    }
    .infoRowOuterWidth(expands: !hasTitle)
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
  EVYInfoRowPreview()
}

private struct EVYInfoRowPreview: View {
  private let row = EVYInfoRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build info row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-info-row",
        "type": "Info",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Amazing Fridge",
            "subtitle": "A fantastic fridge in great condition",
            "icon": "::star::"
          }
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
