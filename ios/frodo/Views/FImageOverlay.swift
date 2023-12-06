//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct FImageOverlay: View {
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
    FImageOverlay(imageName: "printer")
}
