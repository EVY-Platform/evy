//
//  EVYImageOverlay.swift
//  EVY
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct EVYImageOverlay: View {
    @Environment(\.dismiss) var dismiss
    
    let imageName: String
    
    var body: some View {
        ZStack {
            EVYZoomableContainer{
                Image(imageName)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            }.background(Color.black)
            Button(action: { dismiss() }) {
                Label("", systemImage: "xmark")
                    .foregroundColor(.white)
                    .font(.evyButton)
            }
            .padding(Constants.majorPadding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

#Preview {
    EVYImageOverlay(imageName: "printer")
}
