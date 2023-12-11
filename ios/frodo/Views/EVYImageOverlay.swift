//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct EVYImageOverlay: View {
    let imageName: String
    
    var body: some View {
        ZoomableContainer{
            Image(imageName)
                .resizable()
                .aspectRatio(contentMode: .fit)
        }.background(Color.black)
    }
}

#Preview {
    EVYImageOverlay(imageName: "printer")
}
