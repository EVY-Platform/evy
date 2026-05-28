//
//  EVYRemoteImage.swift
//  evy
//

import SwiftUI

struct EVYRemoteImage: View {
  let imageId: String

  @State private var loadedImage: Image?
  @State private var isLoading = false

  var body: some View {
    Group {
      if let image = loadedImage {
        image
          .resizable()
          .scaledToFill()
      } else {
        Rectangle()
          .fill(Color.gray.opacity(0.3))
          .overlay(
            Group {
              if isLoading {
                EVYLoadingIndicator()
              }
            }
          )
      }
    }
    .task(id: imageId) {
      await loadImage()
    }
  }

  @MainActor
  private func loadImage() async {
    if let cached = EVYImageCache.swiftUIImage(for: imageId) {
      loadedImage = cached
      return
    }
    isLoading = true
    do {
      let response = try await EVYAPIManager.shared.getImage(id: imageId)
      guard let jpegData = Data(base64Encoded: response.dataBase64) else {
        throw EVYError.imageLoadFailed(name: imageId)
      }
      try EVYImageCache.write(imageId: imageId, jpegData: jpegData)
      if let uiImage = UIImage(data: jpegData) {
        loadedImage = Image(uiImage: uiImage)
      }
    } catch {
      NotificationCenter.default.post(
        name: .evyErrorOccurred,
        object: EVYError.imageLoadFailed(name: imageId)
      )
    }
    isLoading = false
  }
}
