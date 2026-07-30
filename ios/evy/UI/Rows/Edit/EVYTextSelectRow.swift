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
  private let onTap: EVYRowTapCallback<EVYJson>

  init?(
    view: TextSelectRowViewData,
    onTap: @escaping EVYRowTapCallback<EVYJson>,
    scope: EVYScope? = nil
  ) {
    let destination = view.destination.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !destination.isEmpty else { return nil }
    self.view = view
    self.destination = destination
    self.onTap = onTap
    let sourceExpression = view.source
    self.selected = EVYState(
      textToWatch: sourceExpression,
      scope: scope,
      setter: {
        do {
          return try EVY.evaluateFromText(sourceExpression)
        } catch {
          return false
        }
      })
    let temporaryId = UUID().uuidString
    let temporaryScopeId = EVYDraft.createMergeScopeId(flowId: "temporary", entityKey: temporaryId)

    guard
      let text = view.text,
      (try? EVY.updateValue(text, destination: temporaryId, scopeId: temporaryScopeId)) != nil,
      let binding = try? EVY.draftStore.binding(
        fromParsedProps: temporaryId, scopeId: temporaryScopeId),
      let draft = EVY.draftStore.draftIfPresent(binding: binding),
      let decoded = try? draft.decoded()
    else { return nil }
    self.value = decoded
  }

  @Environment(\.evyScope) private var evyScope

  var body: some View {
    EVYSelectItem(
      destination: destination,
      value: value,
      valueTemplate: nil,
      selectionStyle: .multi,
      target: .single_bool,
      textStyle: .info,
      onTap: { performDefault in
        onTap(
          value,
          EVYRowActionOperation.selectHandler { _ in
            try performDefault()
          })
      },
      scope: evyScope
    )
    .frame(maxWidth: .infinity, alignment: .leading)
    .titledRow(view.title)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-textselect-row",
        "type": "text_select",
        "source": "{item.condition}",
        "destination": "{item.condition}",
        "actions": {"tap": [{"condition": "", "true": "{select($datum)}", "false": ""}]},
        "title": "Selling reason",
        "text": "reason-1"
      }
      """,
    failureMessage: "Unable to build text select row preview"
  )
}
