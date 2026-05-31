//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYTextRow: View {

  private let view: TextRowViewData
  @State private var showSheet = false
  @State private var canBeExpanded: Bool = false

  init(view: TextRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      EVYRowTitle(title: view.content.title)
      if !view.content.action.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        actionText
      } else {
        expandableText
      }
    }
    .padding(.horizontal, Constants.majorPadding)
  }

  private var actionText: some View {
    HStack {
      EVYTextView(
        view.content.text,
        placeholder: view.content.placeholder,
        style: .info
      )
      .frame(maxWidth: .infinity, alignment: .leading)
      EVYTextView(view.content.action, style: .action)
    }
  }

  private var expandableText: some View {
    VStack(alignment: .leading) {
      EVYTextView(view.content.text)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lineLimit(Int(view.max_lines) ?? 1)
        .background {
          ViewThatFits(in: .vertical) {
            EVYTextView(view.content.text).hidden()
            Color.clear.onAppear {
              canBeExpanded = true
            }
          }
        }
        .sheet(isPresented: $showSheet) {
          EVYTextView(view.content.text)
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(.top, Constants.majorPadding)
            .presentationDragIndicator(.visible)
        }
      if canBeExpanded {
        EVYTextView("Read more", style: .action)
          .padding(.vertical, Constants.padding)
      }
    }
    .contentShape(Rectangle())
    .onTapGesture {
      if canBeExpanded {
        showSheet.toggle()
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-text-row",
        "type": "Text",
        "source": "",
        "actions": [],
        "view": {
          "content": {
            "title": "About this item",
            "text": "This is a sample text row with some descriptive content to display. It can be quite long and the user can tap to expand it.",
            "placeholder": "",
            "action": ""
          },
          "max_lines": "3"
        }
      }
      """,
    failureMessage: "Unable to build text row preview"
  )
}
