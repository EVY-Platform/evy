//
//  EVYSelectPhotoRow.swift
//  evy
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
    EVYSelectPhoto(
      title: view.content.title,
      subtitle: view.content.subtitle,
      icon: view.content.icon,
      content: view.content.content,
      data: view.content.photos,
      destination: destination
    )
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-selectphoto-row",
        "type": "SelectPhoto",
        "source": "",
        "destination": "{item.photo_ids}",
        "actions": [],
        "view": {
          "content": {
            "title": "Photos",
            "icon": "::image-plus::",
            "subtitle": "Add photos of your item",
            "content": "Add up to 10 photos",
            "photos": "{item.photo_ids}"
          }
        }
      }
      """,
    failureMessage: "Unable to build select photo row preview"
  )
}
