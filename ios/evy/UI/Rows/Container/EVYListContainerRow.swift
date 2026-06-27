//
//  EVYListContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

private struct EVYListContainerDynamicRow: Equatable, Identifiable {
  let row: UI_Row
  var id: String { row.id }

  static func == (lhs: EVYListContainerDynamicRow, rhs: EVYListContainerDynamicRow) -> Bool {
    lhs.id == rhs.id
  }
}

struct EVYListContainerRow: View {

  private let view: ListContainerRowViewData
  private let source: String
  private let childRef: EVYRowRef?
  private let childRefs: [EVYRowRef]
  private var dynamicRows: EVYState<[EVYListContainerDynamicRow]>

  init(view: ListContainerRowViewData, source: String, childRef: EVYRowRef?, childRefs: [EVYRowRef])
  {
    self.view = view
    self.source = source
    self.childRef = childRef
    self.childRefs = childRefs

    let templateRef = childRef
    dynamicRows = EVYState(
      textToWatch: source,
      setter: {
        guard let templateRef, !source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return [] }

        guard let template = templateRef.templateRow() else { return [] }

        do {
          let data = try EVY.getDataFromText(source)
          let dataRows: [EVYJson]
          if case .array(let arrayValue) = data {
            dataRows = arrayValue
          } else {
            dataRows = [data]
          }

          let formatter = try EVYDatumRowFormatter(template: template)
          return dataRows.compactMap { datum in
            guard let row = try? formatter.formattedResult(datum: datum).row else {
              return nil
            }
            return EVYListContainerDynamicRow(row: row)
          }
        } catch {
          return []
        }
      })
  }

  var body: some View {
    VStack(alignment: .leading) {
      if !view.title.isEmpty {
        EVYTextView(view.title)
          .padding(.vertical, Constants.padding)
          .padding(.horizontal, Constants.majorPadding)
      }
      ForEach(dynamicRows.value) { dynamicRow in
        EVYRow(row: dynamicRow.row)
      }
      ForEach(childRefs, id: \.id) { ref in
        EVYRow(ref: ref)
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-list-row",
        "type": "ListContainer",
        "source": "{items}",
        "actions": [],
        "title": "List Container Preview",
        "child": {
          "id": "list-child-template",
          "type": "Text",
          "source": "",
          "actions": [],
          "title": "{$datum.title}",
          "subtitle": "",
          "icon": ""
        },
        "children": [
          {
            "id": "list-extra-child",
            "type": "Text",
            "source": "",
            "actions": [],
            "title": "Extra row",
            "subtitle": "Static child below dynamic rows",
            "icon": ""
          }
        ]
      }
      """,
    failureMessage: "Unable to build list container row preview"
  )
}
