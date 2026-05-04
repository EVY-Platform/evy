//
//  EVYCalendarRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 11/8/2024.
//

import SwiftUI

struct EVYCalendarRow: View {

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
  EVYCalendarRowPreview()
}

private struct EVYCalendarRowPreview: View {
  private let row = EVYCalendarRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
    let previewScopeId = EVYDraft.createMergeScopeId(flowId: "preview", entityKey: "timeslots")
    EVY.draftStore.activeScopeId = previewScopeId
    let timeslotsData = EVYPreviewMockData.timeslots.data(using: .utf8)
    EVY.ensureDraftExists(
      variableName: "pickup_timeslots",
      initialData: timeslotsData,
      scopeId: previewScopeId
    )
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build calendar row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-calendar-row",
        "type": "Calendar",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Select a date",
            "primary": "{pickup_timeslots}",
            "secondary": "{pickup_timeslots}"
          }
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
