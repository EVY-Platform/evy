//
//  EVYTitleSubtitleRow.swift
//  evy
//

import SwiftUI

/// Shared skeleton for rows rendering an optional title, an optional subtitle,
/// and a trailing element, laid out as `HStack { VStack { title, subtitle } + trailing }`.
struct EVYTitleSubtitleRow<Trailing: View>: View {
  let title: String?
  let subtitle: String?
  let titleBold: Bool
  let centerSubtitleWhenTitleEmpty: Bool
  @ViewBuilder let trailing: () -> Trailing

  // Text states must resolve under this row's page scope, not whatever page
  // happens to own the globals when the state is (re)built.
  @Environment(\.evyScope) private var evyScope

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

  private var showsTitle: Bool {
    guard let title, !title.isEmpty else { return false }
    return true
  }

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading) {
        if showsTitle, let title {
          titleView(title)
        }
        if let subtitle, !subtitle.isEmpty {
          EVYTextView(subtitle, style: .info, scope: evyScope)
            .frame(
              maxWidth: .infinity,
              alignment: centerSubtitleWhenTitleEmpty && !showsTitle
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
      EVYTextView(title, style: .bodyBold, scope: evyScope)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lineLimit(1)
        .truncationMode(.tail)
    } else {
      EVYTextView(title, scope: evyScope)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lineLimit(1)
        .truncationMode(.tail)
    }
  }
}
