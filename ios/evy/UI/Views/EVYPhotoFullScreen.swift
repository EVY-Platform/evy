//
//  EVYPhotoFullScreen.swift
//  evy
//

import SwiftUI

struct EVYPhotoFullScreen: View {
  let fileId: String
  let onDismiss: () -> Void

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()
      EVYRemoteFile(fileId: fileId)
        .scaledToFit()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture(perform: onDismiss)
      VStack {
        HStack {
          Spacer()
          Button(action: onDismiss) {
            Image(systemName: "xmark.circle.fill")
              .font(.title)
              .foregroundStyle(.white.opacity(0.9))
          }
          .buttonStyle(.plain)
          .padding(Constants.majorPadding)
        }
        Spacer()
      }
    }
  }
}
