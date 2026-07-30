//
//  EVYSelectPhotoRow.swift
//  evy
//

import PhotosUI
import SwiftUI

struct EVYSelectPhotoRow: View {

  private let view: SelectPhotoRowViewData
  private let onRunRowActions: (@escaping EVYRowOperationHandler) -> Void
  private let onDeletePhotoTapped: (@escaping EVYRowOperationHandler) -> Void

  init(
    view: SelectPhotoRowViewData,
    onRunRowActions: @escaping (@escaping EVYRowOperationHandler) -> Void,
    onDeletePhotoTapped: @escaping (@escaping EVYRowOperationHandler) -> Void
  ) {
    self.view = view
    self.onRunRowActions = onRunRowActions
    self.onDeletePhotoTapped = onDeletePhotoTapped
  }

  var body: some View {
    EVYSelectPhoto(
      title: view.title,
      subtitle: view.subtitle,
      icon: view.icon,
      content: view.content,
      data: view.source,
      destination: view.destination,
      onAddPhotoTapped: onRunRowActions,
      onDeletePhotoTapped: onDeletePhotoTapped
    )
    .padding(.horizontal, Constants.majorPadding)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-selectphoto-row",
        "type": "select_photo",
        "source": "{item.photo_ids}",
        "destination": "{item.photo_ids}",
        "actions": {
          "tap": [{"condition": "", "true": "{select_photo()}", "false": ""}],
          "delete": [{"condition": "", "true": "{delete_photo()}", "false": ""}]
        },
        "title": "Photos",
        "icon": "::image-plus::",
        "subtitle": "Add photos of your item",
        "content": "Add up to 10 photos"
      }
      """,
    failureMessage: "Unable to build select photo row preview"
  )
}
