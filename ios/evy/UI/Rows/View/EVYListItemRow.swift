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

  private var imageId: String? {
    guard let image = view.image?.trimmingCharacters(in: .whitespacesAndNewlines),
      !image.isEmpty
    else { return nil }
    let resolved = (try? EVY.getDataFromText(image))?.toString() ?? image
    let trimmed = resolved.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, !trimmed.hasPrefix("{"), !trimmed.hasPrefix("[") else {
      return nil
    }
    return trimmed
  }

  var body: some View {
    HStack(alignment: .center, spacing: 8) {
      if let imageId {
        EVYRemoteFile(fileId: imageId)
          .frame(width: 52, height: 52)
          .clipShape(RoundedRectangle(cornerRadius: 4))
      }

      VStack(alignment: .leading, spacing: 2) {
        if let title = view.title, !title.isEmpty {
          EVYTextView(title)
            .lineLimit(1)
            .truncationMode(.tail)
        }
        if let subtitle = view.subtitle, !subtitle.isEmpty {
          EVYTextView(subtitle, style: .info)
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
        "actions": {},
        "visible": "true",
        "title": "Red mountain bike",
        "subtitle": "Great condition · $120",
        "image": ""
      }
      """,
    failureMessage: "Unable to build list item row preview"
  )
}
