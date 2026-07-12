//
//  EVYTimeslotPickerRow.swift
//  evy
//

import SwiftUI

struct EVYTimeslotPickerRow: View {

  private let view: TimeslotPickerRowViewData
  private let onTimeslotSelected: ((_ commit: @escaping () -> Void) -> Void)?

  init(
    view: TimeslotPickerRowViewData,
    onTimeslotSelected: ((_ commit: @escaping () -> Void) -> Void)? = nil
  ) {
    self.view = view
    self.onTimeslotSelected = onTimeslotSelected
  }

  var body: some View {
    VStack(alignment: .leading) {
      if let title = view.title, !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
      }
      EVYTimeslotPicker(
        content: view,
        source: view.source,
        destination: view.destination,
        onTimeslotSelected: onTimeslotSelected
      )
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
    EVY.ensureDraftExists(
      variableName: "selected_timeslot",
      initialData: "\"\"".data(using: .utf8),
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
        "destination": "{selected_timeslot}",
        "actions": [],
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
