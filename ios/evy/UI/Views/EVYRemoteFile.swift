//
//  EVYRemoteFile.swift
//  evy
//

import SwiftUI

struct EVYRemoteFile: View {
  let fileId: String

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
    .task(id: fileId) {
      await loadFile()
    }
  }

  @MainActor
  private func loadFile() async {
    if let cached = EVYFileCache.swiftUIImage(for: fileId) {
      loadedImage = cached
      return
    }
    isLoading = true
    do {
      let response = try await EVYAPIManager.shared.getFile(id: fileId)
      guard let imageData = Data(base64Encoded: response.dataBase64) else {
        throw EVYError.imageLoadFailed(name: fileId)
      }
      try EVYFileCache.write(fileId: fileId, data: imageData)
      if let uiImage = UIImage(data: imageData) {
        loadedImage = Image(uiImage: uiImage)
      }
    } catch {
      NotificationCenter.default.post(
        name: .evyErrorOccurred,
        object: EVYError.imageLoadFailed(name: fileId)
      )
    }
    isLoading = false
  }
}
