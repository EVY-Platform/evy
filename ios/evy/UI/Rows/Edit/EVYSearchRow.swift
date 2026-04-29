//
//  EVYSearchRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 09/04/2024.
//

import SwiftUI

struct EVYSearchRow: View {

  private let view: SearchRowViewData
  private let source: String
  private let destination: String
  private let actions: [UI_RowAction]
  @State private var showSheet = false

  init(view: SearchRowViewData, source: String, destination: String, actions: [UI_RowAction]) {
    self.view = view
    self.source = source
    self.destination = destination
    self.actions = actions
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      EVYSearch(
        source: source,
        destination: destination,
        placeholder: view.content.placeholder,
        resultTemplate: view.content.child,
        actions: actions
      )
    }
  }
}

#Preview {
  AsyncPreview { asyncView in
    EVYRow(row: asyncView)
  } view: {
    try! await EVYPreviewFixtures.getRow(["2", "pages", "0", "rows", "6", "view", "content", "children", "0"])
  }
}
