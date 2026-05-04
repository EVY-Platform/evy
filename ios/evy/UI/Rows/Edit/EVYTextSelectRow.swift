//
//  EVYTextSelectRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYTextSelectRow: View {

  private let view: TextSelectRowViewData
  private let destination: String
  private let actions: [UI_RowAction]
  private let value: EVYJson
  private let selected: EVYState<Bool>

  init?(view: TextSelectRowViewData, destination: String, actions: [UI_RowAction]) {
    guard !destination.isEmpty else { return nil }
    self.view = view
    self.destination = destination
    self.actions = actions
    self.selected = EVYState(
      watch: destination,
      setter: {
        do {
          return try EVY.evaluateFromText($0)
        } catch {
          return false
        }
      })
    let temporaryId = UUID().uuidString
    let temporaryScopeId = EVYDraft.createMergeScopeId(flowId: "temporary", entityKey: temporaryId)

    guard
      (try? EVY.updateValue(view.content.text, at: temporaryId, scopeId: temporaryScopeId)) != nil,
      let binding = try? EVY.draftStore.binding(
        fromParsedProps: temporaryId, scopeId: temporaryScopeId),
      let draft = EVY.draftStore.draftIfPresent(binding: binding),
      let decoded = try? draft.decoded()
    else { return nil }
    self.value = decoded
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
          .padding(.vertical, Constants.padding)
      }
      EVYSelectItem(
        destination: destination,
        value: value,
        format: "",
        selectionStyle: .multi,
        target: .single_bool,
        textStyle: .info
      )
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

#Preview {
  EVYTextSelectRowPreview()
}

private struct EVYTextSelectRowPreview: View {
  private let row = EVYTextSelectRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build text select row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-textselect-row",
        "type": "TextSelect",
        "source": "",
        "destination": "{items.condition}",
        "actions": [],
        "view": {
          "content": {
            "title": "Selling reason",
            "text": "reason-1"
          }
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
