//
//  EVYSheetContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSheetContainerRow: View {

  private let view: SheetContainerRowViewData
  @State private var showSheet: Bool = false

  init(view: SheetContainerRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
      }
      if let child = view.content.child {
        EVYRow(row: child)
          .contentShape(Rectangle())
          .onTapGesture { showSheet.toggle() }
          .sheet(isPresented: $showSheet) {
            VStack {
              ForEach(view.content.children, id: \.id) { row in
                EVYRow(row: row)
              }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.white.ignoresSafeArea())
            .padding(.top, Constants.majorPadding)
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground(.white)
          }
      }
    }
  }
}

#Preview {
  EVYSheetContainerRowPreview()
}

private struct EVYSheetContainerRowPreview: View {
  private let row = EVYSheetContainerRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build sheet container row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-sheet-row",
        "type": "SheetContainer",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "Sheet Container Preview",
            "child": {
              "id": "sheet-trigger",
              "type": "Info",
              "source": "",
              "actions": [],
              "view": {
                "content": {
                  "title": "Tap to open sheet",
                  "subtitle": "More options available",
                  "icon": "::chevron-right::"
                }
              }
            },
            "children": [
              {
                "id": "sheet-content-1",
                "type": "Info",
                "source": "",
                "actions": [],
                "view": {
                  "content": {
                    "title": "Sheet Content",
                    "subtitle": "This appears in the sheet overlay",
                    "icon": ""
                  }
                }
              }
            ]
          }
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
