//
//  FCarousel.swift
//  frodo
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct FCarousel: View {
    var imageNames: [String] = ["printer_logo","printer"]
    @State private var selectedImageIndex: Int = 0
    @State var showFullScreen = false
    
    var body: some View {
        NavigationView {
            ZStack {
                TabView(selection: $selectedImageIndex) {
                    ForEach(0..<imageNames.count, id: \.self) { index in
                        Image("\(imageNames[index])")
                            .resizable()
                            .tag(index)
                            .aspectRatio(contentMode: .fill)
                            .onTapGesture {
                                showFullScreen = true
                            }
                    }
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))

                HStack {
                    ForEach(0..<imageNames.count, id: \.self) { index in
                        Capsule()
                            .fill(Color.white.opacity(selectedImageIndex == index ? 1 : 0.33))
                            .frame(width: 35, height: 8)
                            .onTapGesture {
                                selectedImageIndex = index
                            }
                    }
                    .offset(y: 130)
                }
            }
        }
        .sheet(isPresented: $showFullScreen) {
            FImageOverlay(imageName: "\(imageNames[selectedImageIndex])")
        }
    }
}

#Preview {
    FCarousel()
}
