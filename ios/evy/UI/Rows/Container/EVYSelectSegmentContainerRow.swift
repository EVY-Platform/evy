//
//  EVYSelectSegmentContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

struct EVYSelectSegmentContainerRow: View, EVYRowProtocol {
  public static let JSONType = "SelectSegmentContainer"

  private let view: SelectSegmentContainerRowViewData
  @State private var selected: Int = 0

  init(view: SelectSegmentContainerRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
      }
      Picker("", selection: $selected) {
        ForEach(Array(view.content.segments.enumerated()), id: \.offset) { index, segment in
          Text(segment).tag(index)
        }
      }
      .pickerStyle(.segmented)
      .padding(.bottom, Constants.majorPadding)

      if selected < view.content.children.count {
        EVYRow(row: view.content.children[selected])
      }
    }
  }
}

#Preview {
  AsyncPreview { asyncView in
    EVYRow(row: asyncView)
  } view: {
    try! await EVY.getRow(["2", "pages", "2", "rows", "0"])
  }
}
