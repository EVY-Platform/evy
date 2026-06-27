//
//  EVYTimeslotPickerRow.swift
//  evy
//

import SwiftUI

struct EVYTimeslotPickerRow: View {

  private let view: TimeslotPickerRowViewData
  private let source: String

  init(view: TimeslotPickerRowViewData, source: String) {
    self.view = view
    self.source = source
  }

  var body: some View {
    VStack(alignment: .leading) {
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
      }
      EVYTimeslotPicker(content: view, source: source)
    }
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYTimeslotPickerRowPreview()
}

private struct EVYTimeslotPickerRowPreview: View {
  private let row = EVYTimeslotPickerRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
    let previewScopeId = EVYDraft.createMergeScopeId(flowId: "preview", entityKey: "item")
    EVY.draftStore.activeScopeId = previewScopeId
    EVY.ensureDraftExists(
      variableName: "pickup_selection",
      initialData: EVYPreviewMockData.calendarPickupSelection.data(using: .utf8),
      scopeId: previewScopeId
    )
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build timeslot picker row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-timeslotpicker-row",
        "type": "TimeslotPicker",
        "source": "{pickup_selection}",
        "destination": "",
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
