//
//  EVYTimeslotPickerRow.swift
//  evy
//

import SwiftUI

struct EVYTimeslotPickerRow: View {

  private let view: TimeslotPickerRowViewData

  init(view: TimeslotPickerRowViewData) {
    self.view = view
  }

  var body: some View {
    EVYRowTitle(title: view.content.title)
      .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-timeslotpicker-row",
        "type": "TimeslotPicker",
        "source": "",
        "destination": "",
        "actions": [],
        "view": { "content": { "title": "Timeslot Picker" } }
      }
      """,
    failureMessage: "Unable to build timeslot picker row preview"
  )
}
