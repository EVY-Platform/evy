//
//  EVYPhotoGalleryRow.swift
//  evy
//

import SwiftUI

struct EVYPhotoGalleryRow: View {
  private let view: PhotoGalleryRowViewData
  private let source: String

  init(view: PhotoGalleryRowViewData, source: String) {
    self.view = view
    self.source = source
  }

  private var imageIds: [String] {
    let data = try? EVY.getDataFromText(source)
    if case .array(let arrayValue) = data {
      return arrayValue.map { $0.toString() }
    } else {
      return []
    }
  }

  var body: some View {
    EVYPhotoGallery(title: view.content.title, imageIds: imageIds)
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-photogallery-row",
        "type": "PhotoGallery",
        "source": "",
        "destination": "",
        "actions": [],
        "view": { "content": { "title": "Photo Gallery" } }
      }
      """,
    failureMessage: "Unable to build photo gallery row preview"
  )
}
