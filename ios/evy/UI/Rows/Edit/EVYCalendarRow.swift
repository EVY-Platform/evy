//
//  EVYCalendarRow.swift
//  evy
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
        EVYCalendar(content: view.content)
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
              "source": "",
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
