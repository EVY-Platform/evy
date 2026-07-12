//
//  EVYTextRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextRow: View {

  private let view: TextRowViewData

  init(view: TextRowViewData) {
    self.view = view
  }

  var body: some View {
    EVYTitleSubtitleRow(
      title: view.title,
      subtitle: view.subtitle,
      centerSubtitleWhenTitleEmpty: true
    ) {
      if let label = view.label, !label.isEmpty {
        EVYTextView(label, style: .info)
      }
    }
  }
}

/// Shared skeleton for rows rendering an optional title, an optional subtitle,
/// and a trailing element, laid out as `HStack { VStack { title, subtitle } + trailing }`.
struct EVYTitleSubtitleRow<Trailing: View>: View {
  let title: String?
  let subtitle: String?
  let titleBold: Bool
  let centerSubtitleWhenTitleEmpty: Bool
  @ViewBuilder let trailing: () -> Trailing

  init(
    title: String?,
    subtitle: String? = nil,
    titleBold: Bool = false,
    centerSubtitleWhenTitleEmpty: Bool = false,
    @ViewBuilder trailing: @escaping () -> Trailing
  ) {
    self.title = title
    self.subtitle = subtitle
    self.titleBold = titleBold
    self.centerSubtitleWhenTitleEmpty = centerSubtitleWhenTitleEmpty
    self.trailing = trailing
  }

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading) {
        if let title, !title.isEmpty {
          titleView(title)
        }
        if let subtitle, !subtitle.isEmpty {
          EVYTextView(subtitle, style: .info)
            .frame(
              maxWidth: .infinity,
              alignment: centerSubtitleWhenTitleEmpty && (title?.isEmpty ?? true)
                ? .center : .leading
            )
            .lineLimit(3)
            .truncationMode(.tail)
        }
      }
      trailing()
    }
    .padding(.horizontal, Constants.majorPadding)
  }

  @ViewBuilder
  private func titleView(_ title: String) -> some View {
    if titleBold {
      EVYTextView(title).toText().bold()
        .frame(maxWidth: .infinity, alignment: .leading)
        .lineLimit(1)
        .truncationMode(.tail)
    } else {
      EVYTextView(title)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lineLimit(1)
        .truncationMode(.tail)
    }
  }
}

#Preview("Title, subtitle, and label") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-full",
        "type": "Text",
        "actions": [],
        "visible": "true",
        "title": "Pickup address",
        "subtitle": "123 Market Street, San Francisco",
        "label": "Default"
      }
      """,
    failureMessage: "Unable to build text row preview"
  )
}

#Preview("Title only") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-title-only",
        "type": "Text",
        "actions": [],
        "visible": "true",
        "title": "Pickup address"
      }
      """,
    failureMessage: "Unable to build title-only text row preview"
  )
}

#Preview("Subtitle only") {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row-subtitle-only",
        "type": "Text",
        "actions": [],
        "visible": "true",
        "subtitle": "Available between 10 AM and 2 PM"
      }
      """,
    failureMessage: "Unable to build subtitle-only text row preview"
  )
}
