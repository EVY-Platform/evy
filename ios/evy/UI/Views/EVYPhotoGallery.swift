//
//  EVYPhotoGallery.swift
//  evy
//

import SwiftUI

struct EVYPhotoGallery: View {
  let title: String
  let imageIds: [String]

  @State private var selectedImageIndex = 0

  init(title: String, imageIds: [String] = []) {
    self.title = title
    self.imageIds = imageIds
  }

  var body: some View {
    VStack(spacing: 0) {
      if !title.isEmpty {
        EVYRowTitle(title: title)
          .padding(.horizontal, Constants.majorPadding)
      }
      if !imageIds.isEmpty {
        TabView(selection: $selectedImageIndex) {
          ForEach(imageIds.indices, id: \.self) { index in
            EVYRemoteFile(fileId: imageIds[index])
              .frame(maxWidth: .infinity, maxHeight: .infinity)
              .clipped()
              .tag(index)
          }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(maxWidth: .infinity)
        .aspectRatio(4 / 3, contentMode: .fit)
        .background(Constants.inactiveBackground)
        .clipped()
        .overlay(alignment: .bottom) {

          EVYCarouselIndicator(
            indices: 0...(imageIds.count - 1),
            selectionIndex: selectedImageIndex,
            color: .white
          )
        }
      }
    }
    .frame(maxWidth: .infinity)
  }
}

#Preview {
  EVYPhotoGallery(title: "Photo Gallery")
}
