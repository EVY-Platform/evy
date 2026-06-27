//
//  EVYCalendarRow.swift
//  evy
//

import SwiftUI

struct EVYCalendarRow: View {

  private let view: CalendarRowViewData
  private let source: String
  private let destination: String

  init(view: CalendarRowViewData, source: String, destination: String) {
    self.view = view
    self.source = source
    self.destination = destination
  }

  var body: some View {
    VStack(alignment: .leading) {
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
      }
      EVYCalendar(content: view, source: source, destination: destination)
    }
    .padding(.horizontal, Constants.majorPadding)
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
    let primaryData = EVYPreviewMockData.calendarPickupSelection.data(using: .utf8)
    let secondaryData = EVYPreviewMockData.calendarDeliverySelection.data(using: .utf8)
    EVY.ensureDraftExists(
      variableName: EVYPreviewMockData.calendarPreviewDestinationVariable,
      initialData: primaryData,
      scopeId: previewScopeId
    )
    EVY.ensureDraftExists(
      variableName: EVYPreviewMockData.calendarPreviewSourceVariable,
      initialData: secondaryData,
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
        "actions": [],
        "title": "",
        "start_time": "07:00",
        "end_time": "19:00",
        "timeslot_interval_minutes": 30,
        "label_interval_minutes": 60,
        "header_format": "EEE d",
        "timeslot_format": "HH:mm"
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
