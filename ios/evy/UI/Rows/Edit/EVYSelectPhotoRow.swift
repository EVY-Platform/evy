//
//  EVYSelectPhotoRow.swift
//  evy
//
//  Created by Clemence Chalot on 18/02/2024.
//

import PhotosUI
import SwiftUI

struct EVYSelectPhotoRow: View {

  private let view: SelectPhotoRowViewData
  private let destination: String

  init(view: SelectPhotoRowViewData, destination: String) {
    self.view = view
    self.destination = destination
  }

  var body: some View {
    if !destination.isEmpty {
      EVYSelectPhoto(
        title: view.content.title,
        subtitle: view.content.subtitle,
        icon: view.content.icon,
        content: view.content.content,
        data: view.content.photos,
        destination: destination
      )
    } else {
      Text("Failed to load photo selector")
        .foregroundColor(.red)
    }
  }
}

#Preview {
  EVYSelectPhotoRowPreview()
}

private struct EVYSelectPhotoRowPreview: View {
  private let row = EVYSelectPhotoRowPreview.makeRow()

  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    if let row { EVYRow(row: row) } else { Text("Unable to build select photo row preview") }
  }

  private static func makeRow() -> UI_Row? {
    let json = """
      {
        "id": "preview-selectphoto-row",
        "type": "SelectPhoto",
        "source": "",
        "destination": "{items.photo_ids}",
        "actions": [],
        "view": {
          "content": {
            "title": "Photos",
            "icon": "::image-plus::",
            "subtitle": "Add photos of your item",
            "content": "Add up to 10 photos",
            "photos": "{items.photo_ids}"
          }
        }
      }
      """
    return EVYPreviewMockData.decodeRow(from: json)
  }
}
