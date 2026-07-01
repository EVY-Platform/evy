//
//  EVYSelectPhotoRow.swift
//  evy
//

import PhotosUI
import SwiftUI

struct EVYSelectPhotoRow: View {

  private let view: SelectPhotoRowViewData

  init(view: SelectPhotoRowViewData) {
    self.view = view
  }

  var body: some View {
    EVYSelectPhoto(
      title: view.title,
      subtitle: view.subtitle,
      icon: view.icon,
      content: view.content,
      data: view.source,
      destination: view.destination
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
        "source": "{item.photo_ids}",
        "destination": "{item.photo_ids}",
        "actions": [],
        "title": "Photos",
        "icon": "::image-plus::",
        "subtitle": "Add photos of your item",
        "content": "Add up to 10 photos"
      }
      """,
    failureMessage: "Unable to build select photo row preview"
  )
}
