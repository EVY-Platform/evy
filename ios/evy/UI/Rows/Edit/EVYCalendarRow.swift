//
//  EVYCalendarRow.swift
//  evy
//

import SwiftUI

struct EVYCalendarRow: View {

  private let view: CalendarRowViewData
  private let onSlotTapped: EVYRowTapCallback<String>
  private let onRowTapped: EVYRowTapCallback<[String]>
  private let onColumnTapped: EVYRowTapCallback<[String]>

  init(
    view: CalendarRowViewData,
    onSlotTapped: @escaping EVYRowTapCallback<String>,
    onRowTapped: @escaping EVYRowTapCallback<[String]>,
    onColumnTapped: @escaping EVYRowTapCallback<[String]>
  ) {
    self.view = view
    self.onSlotTapped = onSlotTapped
    self.onRowTapped = onRowTapped
    self.onColumnTapped = onColumnTapped
  }

  @Environment(\.evyScope) private var evyScope

  var body: some View {
    let selectHandler = EVYRowActionOperation.selectHandler { value in
      try EVYCalendar.applyPrimarySelection(value: value, destination: view.destination)
    }
    EVYCalendar(
      content: view,
      onSlotTapped: { dateTimeISO in
        onSlotTapped(dateTimeISO, selectHandler)
      },
      onRowTapped: { dateTimeISOs in
        onRowTapped(dateTimeISOs, selectHandler)
      },
      onColumnTapped: { dateTimeISOs in
        onColumnTapped(dateTimeISOs, selectHandler)
      },
      scope: evyScope
    )
    .titledRow(view.title)
  }
}

#Preview {
  EVYCalendarRowPreview()
}

private struct EVYCalendarRowPreview: View {
  private let row = EVYCalendarRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
    let previewScopeId = EVYDraft.createMergeScopeId(flowId: "preview", entityKey: "item")
    EVY.draftStore.activeScopeId = previewScopeId
    EVY.ensureDraftExists(
      variableName: "pickup_selection",
      initialData: EVYPreviewMockData.calendarPickupSelection.data(using: .utf8),
      scopeId: previewScopeId
    )
    EVY.ensureDraftExists(
      variableName: EVYPreviewMockData.calendarPreviewSecondaryVariable,
      initialData: EVYPreviewMockData.calendarDeliverySelection.data(using: .utf8),
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
        "source": "\(EVYPreviewMockData.calendarPreviewSource)",
        "destination": "\(EVYPreviewMockData.calendarPreviewDestination)",
        "secondary": "\(EVYPreviewMockData.calendarPreviewSecondary)",
        "actions": {
          "tap": [{"condition": "", "true": "{select($datum)}", "false": ""}],
          "tap-row": [{"condition": "", "true": "{select($datum)}", "false": ""}],
          "tap-column": [{"condition": "", "true": "{select($datum)}", "false": ""}]
        },
        "title": "",
        "start_time": "07:00",
        "end_time": "19:00",
        "timeslot_interval_minutes": "30",
        "label_interval_minutes": "60",
        "header_format": "EEE d",
        "timeslot_format": "HH:mm"
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
