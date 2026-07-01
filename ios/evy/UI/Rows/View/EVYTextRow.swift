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
    let content = view

    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading) {
        if let title = content.title, !title.isEmpty {
          EVYTextView(title)
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(1)
            .truncationMode(.tail)
        }
        if let subtitle = content.subtitle, !subtitle.isEmpty {
          EVYTextView(subtitle, style: .info)
            .frame(maxWidth: .infinity, alignment: .leading)
            .lineLimit(3)
            .truncationMode(.tail)
        }
      }
      if let label = content.label, !label.isEmpty {
        EVYTextView(label, style: .info)
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}
