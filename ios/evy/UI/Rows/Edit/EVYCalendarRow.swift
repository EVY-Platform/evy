//
//  EVYCalendarRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 11/8/2024.
//

import SwiftUI

struct EVYCalendarRow: View, EVYRowProtocol {
  public static let JSONType = "Calendar"

  private let view: CalendarRowViewData

  init(view: CalendarRowViewData) {
    self.view = view
  }

  var body: some View {
    if view.content.title.count > 0 {
      EVYTextView(view.content.title)
        .padding(.vertical, Constants.padding)
    }
    EVYCalendar(primary: view.content.primary, secondary: view.content.secondary)
  }
}

#Preview {
  AsyncPreview { asyncView in
    EVYRow(row: asyncView)
  } view: {
    try! await EVY.getRow([
      "2", "pages", "2", "rows", "0", "view", "content", "children", "0", "view", "content",
      "children", "4",
    ])
  }
}
