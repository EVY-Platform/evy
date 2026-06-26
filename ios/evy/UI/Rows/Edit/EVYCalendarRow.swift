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
      if !view.content.title.isEmpty {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      EVYCalendar(content: view.content, source: source, destination: destination)
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
      variableName: "pickup_selection",
      initialData: primaryData,
      scopeId: previewScopeId
    )
    EVY.ensureDraftExists(
      variableName: "delivery_selection",
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
        "source": "{delivery_selection}",
        "destination": "{pickup_selection}",
        "actions": [],
        "view": {
          "content": \(EVYPreviewMockData.calendarContentJSON)
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
