//
//  EVYPhotoGalleryRow.swift
//  evy
//

import SwiftUI

struct EVYPhotoGalleryRow: View {
  private let view: PhotoGalleryRowViewData

  init(view: PhotoGalleryRowViewData) {
    self.view = view
  }

  private var imageIds: [String] {
    let source = view.source
    guard !source.isEmpty else { return [] }
    let data = try? EVY.getDataFromText(source)
    if case .array(let arrayValue) = data {
      return arrayValue.map { $0.toString() }
    } else {
      return []
    }
  }

  var body: some View {
    EVYPhotoGallery(title: view.title ?? "", imageIds: imageIds)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-photogallery-row",
        "type": "PhotoGallery",
        "source": "{item.photo_ids}",
        "actions": [],
        "title": "Photo Gallery"
      }
      """,
    failureMessage: "Unable to build photo gallery row preview"
  )
}
