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
      if !view.content.title.isEmpty {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      EVYTimeslotPicker(content: view.content, source: source)
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
        "view": {
          "content": \(EVYPreviewMockData.calendarContentJSON)
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
