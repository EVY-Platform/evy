//
//  FCarousel.swift
//  frodo
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct FCarousel: View {
    let imageNames: [String]
    @State private var selectedImageIndex: Int = 0
    @State private var showFullScreen = false
    
    var body: some View {
        NavigationView {
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
            .overlay {
                HStack {
                    ForEach(0..<imageNames.count, id: \.self) { index in
                        Capsule()
                            .fill(Color.white.opacity(selectedImageIndex == index ? 1 : 0.33))
                            .frame(width: 35, height: 8)
                            .onTapGesture {
                                selectedImageIndex = index
                            }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .padding()
            }
        }
        .sheet(isPresented: $showFullScreen) {
            FImageOverlay(imageName: "\(imageNames[selectedImageIndex])")
        }
    }
}

#Preview {
    FCarousel(imageNames: ["printer_logo","printer"])
}
