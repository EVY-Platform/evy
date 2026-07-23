//
//  EVYPhotoGalleryRow.swift
//  evy
//

import SwiftUI

private struct FullScreenImageItem: Identifiable {
  let id: String
}

struct EVYPhotoGalleryRow: View {
  private let view: PhotoGalleryRowViewData
  private let onPhotoTapped: EVYRowTapCallback<String>

  @Environment(\.evyScope) private var evyScope
  @State private var fullScreenItem: FullScreenImageItem?

  init(
    view: PhotoGalleryRowViewData,
    onPhotoTapped: @escaping EVYRowTapCallback<String>
  ) {
    self.view = view
    self.onPhotoTapped = onPhotoTapped
  }

  private var imageIds: [String] {
    Self.imageIds(from: view.source, cacheScopeId: evyScope.cacheScopeId)
  }

  static func imageIds(from source: String, cacheScopeId: String?) -> [String] {
    let trimmedSource = source.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedSource.isEmpty else { return [] }

    let previous = EVY.activeCacheScopeId
    EVY.activeCacheScopeId = cacheScopeId
    defer { EVY.activeCacheScopeId = previous }

    let data = try? EVY.getDataFromText(trimmedSource)
    return stringIds(from: data)
  }

  private static func stringIds(from data: EVYJson?) -> [String] {
    switch data {
    case .array(let values):
      return values.compactMap(EVYFileIdSanitizer.sanitizedFileId(from:))
    case .some(let value):
      return EVYFileIdSanitizer.sanitizedFileId(from: value).map { [$0] } ?? []
    case .none:
      return []
    }
  }

  var body: some View {
    EVYPhotoGallery(
      title: view.title ?? "",
      imageIds: imageIds,
      onPhotoTapped: { imageId in
        onPhotoTapped(
          imageId,
          EVYRowActionOperation.handler(for: .expandPhoto) {
            fullScreenItem = FullScreenImageItem(id: imageId)
          })
      }
    )
    .fullScreenCover(item: $fullScreenItem) { item in
      EVYPhotoFullScreen(fileId: item.id) {
        fullScreenItem = nil
      }
    }
  }
}

#Preview {
  EVYPreviewRow(
    json: """
      {
        "id": "preview-photogallery-row",
        "type": "PhotoGallery",
        "source": "{item.photo_ids}",
        "actions": {"tap": [{"condition": "", "true": "{expand_photo()}", "false": ""}]},
        "title": "Photo Gallery"
      }
      """,
    failureMessage: "Unable to build photo gallery row preview"
  )
}
