//
//  EVYPhotoGallery.swift
//  evy
//

import SwiftUI

struct EVYPhotoGallery: View {
  let title: String
  let imageIds: [String]
  let onPhotoTapped: (String) -> Void

  @State private var selectedImageIndex = 0

  init(
    title: String,
    imageIds: [String] = [],
    onPhotoTapped: @escaping (String) -> Void
  ) {
    self.title = title
    self.imageIds = imageIds
    self.onPhotoTapped = onPhotoTapped
  }

  var body: some View {
    VStack(spacing: 0) {
      if !title.isEmpty {
        EVYTextView(title)
          .padding(.vertical, Constants.padding)
          .padding(.horizontal, Constants.majorPadding)
      }
      if !imageIds.isEmpty {
        TabView(selection: $selectedImageIndex) {
          ForEach(imageIds.indices, id: \.self) { index in
            EVYRemoteFile(fileId: imageIds[index])
              .frame(maxWidth: .infinity, maxHeight: .infinity)
              .clipped()
              .contentShape(Rectangle())
              .onTapGesture {
                onPhotoTapped(imageIds[index])
              }
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
  EVYPhotoGallery(title: "Photo Gallery", onPhotoTapped: { _ in })
}
