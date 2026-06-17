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
  private let value: EVYJson
  private let selected: EVYState<Bool>

  init?(view: TextSelectRowViewData, destination: String) {
    guard !destination.isEmpty else { return nil }
    self.view = view
    self.destination = destination
    let watchTargets = EVY.watchTargets(for: destination)
    self.selected = EVYState(
      watches: watchTargets,
      setter: {
        do {
          return try EVY.evaluateFromText(destination)
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
      if !view.content.title.isEmpty {
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
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-textselect-row",
        "type": "TextSelect",
        "source": "",
        "destination": "{item.condition}",
        "actions": [],
        "view": {
          "content": {
            "title": "Selling reason",
            "text": "reason-1"
          }
        }
      }
      """,
    failureMessage: "Unable to build text select row preview"
  )
}
