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
  private var dynamicRows: EVYState<[EVYListContainerDynamicRow]>

  init(view: ListContainerRowViewData, source: String) {
    self.view = view
    self.source = source

    let childTemplate = view.content.child
    let watchTargets = EVY.watchTargets(for: source)
    dynamicRows = EVYState(
      watches: watchTargets,
      setter: {
        guard let childTemplate, !source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
          return []
        }

        do {
          let data = try EVY.getDataFromText(source)
          let dataRows: [EVYJson]
          if case .array(let arrayValue) = data {
            dataRows = arrayValue
          } else {
            dataRows = [data]
          }

          let formatter = try EVYDatumRowFormatter(template: childTemplate)
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
      if !view.content.title.isEmpty {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
          .padding(.horizontal, Constants.majorPadding)
      }
      ForEach(dynamicRows.value) { dynamicRow in
        EVYRow(row: dynamicRow.row)
      }
      ForEach(view.content.children, id: \.id) { child in
        EVYRow(row: child)
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
        "view": {
          "content": {
            "title": "List Container Preview",
            "child": {
              "id": "list-child-template",
              "type": "Text",
              "source": "",
              "actions": [],
              "view": {
                "content": {
                  "title": "{$datum.title}",
                  "subtitle": "",
                  "icon": ""
                }
              }
            },
            "children": [
              {
                "id": "list-extra-child",
                "type": "Text",
                "source": "",
                "actions": [],
                "view": {
                  "content": {
                    "title": "Extra row",
                    "subtitle": "Static child below dynamic rows",
                    "icon": ""
                  }
                }
              }
            ]
          }
        }
      }
      """,
    failureMessage: "Unable to build list container row preview"
  )
}
