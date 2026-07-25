//
//  EVYTimeslotPickerRow.swift
//  evy
//

import SwiftUI

struct EVYTimeslotPickerRow: View {

  private let view: TimeslotPickerRowViewData
  private let onTimeslotTapped: EVYRowTapCallback<EVYJson>

  init(
    view: TimeslotPickerRowViewData,
    onTimeslotTapped: @escaping EVYRowTapCallback<EVYJson>
  ) {
    self.view = view
    self.onTimeslotTapped = onTimeslotTapped
  }

  @Environment(\.evyScope) private var evyScope

  var body: some View {
    EVYTimeslotPicker(
      content: view,
      source: view.source,
      destination: view.destination,
      onTimeslotTapped: onTimeslotTapped,
      scope: evyScope
    )
    .titledRow(view.title)
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
        "actions": {"tap": [{"condition": "", "true": "{select($datum)}", "false": ""}]},
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
