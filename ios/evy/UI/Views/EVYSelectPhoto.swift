//
//  EVYSelectPhoto.swift
//  evy
//

import PhotosUI
import SwiftUI

private let carouselElementSize: CGFloat = 150.0

private enum EVYPhotoTileStatus: Equatable {
  case uploading
  case uploaded
  case ready
  case deleting
}

private struct PreparedPhoto: Sendable {
  let image: Image
  let jpegData: Data
}

private struct EVYPhotoTile: Identifiable, Equatable {
  let id: UUID
  var localImage: Image?
  var imageId: String?
  var status: EVYPhotoTileStatus

  static func == (lhs: EVYPhotoTile, rhs: EVYPhotoTile) -> Bool {
    lhs.id == rhs.id && lhs.status == rhs.status
  }
}

private struct EVYPhotoTileView: View {
  let tile: EVYPhotoTile
  let onRemove: () -> Void

  var body: some View {
    Group {
      if let localImage = tile.localImage {
        localImage
          .resizable()
          .scaledToFill()
      } else if let imageId = tile.imageId {
        EVYRemoteFile(fileId: imageId)
      }
    }
    .frame(width: carouselElementSize, height: carouselElementSize)
    .clipShape(RoundedRectangle(cornerRadius: Constants.mainCornerRadius))
    .overlay(alignment: .bottomTrailing) {
      Group {
        switch tile.status {
        case .uploading:
          EVYLoadingIndicator(tint: .white)
        case .uploaded:
          Image(systemName: "checkmark.square.fill")
            .foregroundStyle(.white)
        case .ready, .deleting:
          EmptyView()
        }
      }
      .padding(Constants.minorPadding)
    }
    .overlay(alignment: .topLeading) {
      if tile.status != .uploading {
        Button(action: onRemove) {
          Image(systemName: "xmark.square.fill")
            .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
        .disabled(tile.status == .deleting)
        .padding(Constants.minorPadding)
      }
    }
  }
}

struct EVYSelectPhoto: View {
  var title: String?
  let subtitle: String?
  let icon: String?
  let content: String?
  let destination: String
  let onAddPhotoTapped: ((@escaping EVYRowOperationHandler) -> Void)?

  @State private var photoTiles: [EVYPhotoTile] = []
  @State private var lastCommittedIds: [String] = []
  @State private var isPickerPresented = false
  @State private var selectedItem: PhotosPickerItem?

  init(
    title: String?,
    subtitle: String?,
    icon: String?,
    content: String?,
    data: String?,
    destination: String,
    onAddPhotoTapped: ((@escaping EVYRowOperationHandler) -> Void)? = nil
  ) {
    self.title = title
    self.icon = icon
    self.content = content
    self.subtitle = subtitle
    self.destination = destination
    self.onAddPhotoTapped = onAddPhotoTapped

    if let data,
      let props = try? EVY.getValueFromText(data),
      let jsonData = props.value.data(using: .utf8),
      let ids = try? JSONDecoder().decode([String].self, from: jsonData)
    {
      let tiles = ids.map { id in
        EVYPhotoTile(id: UUID(), localImage: nil, imageId: id, status: .ready)
      }
      _photoTiles = State(initialValue: tiles)
    }
  }

  var body: some View {
    VStack(alignment: .leading) {
      if title?.count ?? 0 > 0 {
        EVYTextView(title!)
      }

      if photoTiles.isEmpty {
        EVYSelectPhotoButton(
          fullScreen: true,
          icon: icon,
          content: content,
          onAddPhotoTapped: addPhotoTapped)
      } else {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack {
            ForEach(photoTiles) { tile in
              EVYPhotoTileView(
                tile: tile,
                onRemove: { removePhoto(tileId: tile.id) }
              )
              .padding(.horizontal, 2)
            }
            EVYSelectPhotoButton(
              fullScreen: false,
              icon: icon,
              content: content,
              onAddPhotoTapped: addPhotoTapped)
          }
        }
      }

      if let subtitle {
        EVYTextView(subtitle, style: .info)
          .padding(.vertical, Constants.padding)
      }
    }
    .photosPicker(isPresented: $isPickerPresented, selection: $selectedItem, matching: .images)
    .onChange(of: selectedItem) {
      Task {
        await uploadSelectedItem()
      }
    }
    .onChange(of: photoTiles) {
      let currentIds = photoTiles.compactMap(\.imageId)
      guard currentIds != lastCommittedIds else { return }
      lastCommittedIds = currentIds
      do {
        try EVY.writeRawValue(EVYJson.array(currentIds.map { .string($0) }), to: destination)
      } catch {
        #if DEBUG
          print("[EVYSelectPhoto] Error updating photo ids: \(error)")
        #endif
      }
    }
  }

  private func addPhotoTapped() {
    if let onAddPhotoTapped {
      onAddPhotoTapped(
        EVYRowActionOperation.selectPhotoHandler {
          isPickerPresented = true
        })
    } else {
      isPickerPresented = true
    }
  }

  @MainActor
  private func removePhoto(tileId: UUID) {
    guard let index = photoTiles.firstIndex(where: { $0.id == tileId }) else { return }

    guard let imageId = photoTiles[index].imageId else {
      photoTiles.remove(at: index)
      return
    }

    photoTiles[index].status = .deleting
    Task {
      do {
        try await EVYAPIManager.shared.deleteFile(id: imageId)
        EVYFileCache.remove(fileId: imageId)
        photoTiles.removeAll { $0.id == tileId }
      } catch {
        if let i = photoTiles.firstIndex(where: { $0.id == tileId }) {
          photoTiles[i].status = .ready
        }
        NotificationCenter.default.post(
          name: .evyErrorOccurred,
          object: EVYError.imageLoadFailed(name: imageId)
        )
      }
    }
  }

  nonisolated private static func prepareImage(
    from item: PhotosPickerItem
  ) async throws -> PreparedPhoto {
    guard let rawData = try await item.loadTransferable(type: Data.self) else {
      throw EVYError.imageLoadFailed(name: "selected photo")
    }
    return try await Task.detached(priority: .userInitiated) {
      let jpegData = try EVYFileCache.normalizeToJPEG(rawData)
      guard let uiImage = UIImage(data: jpegData) else {
        throw EVYError.imageLoadFailed(name: "selected photo")
      }
      return PreparedPhoto(image: Image(uiImage: uiImage), jpegData: jpegData)
    }.value
  }

  @MainActor
  private func uploadSelectedItem() async {
    guard let item = selectedItem else { return }
    let tileId = UUID()
    do {
      let prepared = try await Self.prepareImage(from: item)

      photoTiles.append(
        EVYPhotoTile(
          id: tileId,
          localImage: prepared.image,
          imageId: nil,
          status: .uploading
        ))

      let loadingStartedAt = ContinuousClock.now
      let imageId = try await EVYAPIManager.shared.uploadFile(prepared.jpegData)
      try EVYFileCache.write(fileId: imageId, data: prepared.jpegData)

      let elapsed = loadingStartedAt.duration(to: .now)
      let minimumLoadingDuration = Duration.seconds(1)
      if elapsed < minimumLoadingDuration {
        try await Task.sleep(for: minimumLoadingDuration - elapsed)
      }

      if let index = photoTiles.firstIndex(where: { $0.id == tileId }) {
        photoTiles[index].imageId = imageId
        photoTiles[index].status = .uploaded
      }

      try await Task.sleep(for: .seconds(1))

      if let index = photoTiles.firstIndex(where: { $0.id == tileId }),
        photoTiles[index].status == .uploaded
      {
        photoTiles[index].status = .ready
      }

      selectedItem = nil
    } catch {
      NotificationCenter.default.post(
        name: .evyErrorOccurred,
        object: EVYError.imageLoadFailed(name: "selected photo")
      )
      photoTiles.removeAll { $0.id == tileId }
      selectedItem = nil
    }
  }
}

private struct EVYSelectPhotoButton: View {
  let fullScreen: Bool
  let icon: String?
  let content: String?
  let onAddPhotoTapped: () -> Void

  var body: some View {
    Button(action: onAddPhotoTapped) {
      let stack = VStack {
        if let icon { EVYTextView(icon) }
        if let content { EVYTextView(content) }
      }
      if fullScreen {
        stack
          .frame(maxWidth: .infinity)
          .frame(height: carouselElementSize)
          .background(
            RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
              .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth))
      } else {
        stack
          .frame(width: carouselElementSize, height: carouselElementSize)
          .background(
            RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
              .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth))
      }
    }
    .buttonStyle(.plain)
  }
}

#Preview {
  EVYSelectPhotoPreview()
}

private struct EVYSelectPhotoPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    EVYSelectPhoto(
      title: "Photos Title",
      subtitle: "{count(photo_ids)}/10 - Choose your listing's main photo first.",
      icon: "::image-plus::",
      content: "A great subtitle",
      data: "{photo_ids}",
      destination: "{photo_ids}")
  }
}
