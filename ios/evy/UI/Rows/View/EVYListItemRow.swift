//
//  EVYListItemRow.swift
//  evy
//

import SwiftUI

struct EVYListItemRow: View {

  private let view: ListItemRowViewData

  init(view: ListItemRowViewData) {
    self.view = view
  }

  private var imageId: String {
    (try? EVY.getDataFromText(view.content.image).toString()) ?? view.content.image
  }

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      EVYRemoteFile(fileId: imageId)
        .frame(width: 52, height: 52)
        .clipShape(RoundedRectangle(cornerRadius: 4))

      VStack(alignment: .leading, spacing: 2) {
        if !view.content.title.isEmpty {
          EVYTextView(view.content.title)
            .lineLimit(1)
            .truncationMode(.tail)
        }
        if !view.content.subtitle.isEmpty {
          EVYTextView(view.content.subtitle, style: .info)
            .lineLimit(2)
            .truncationMode(.tail)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-list-item-row",
        "type": "ListItem",
        "source": "",
        "destination": "",
        "actions": [],
        "visible": "true",
        "view": {
          "content": {
            "title": "Red mountain bike",
            "subtitle": "Great condition · $120",
            "image": ""
          }
        }
      }
      """,
    failureMessage: "Unable to build list item row preview"
  )
}
