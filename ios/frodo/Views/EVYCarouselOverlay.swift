//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct EVYCarouselOverlay: View {
    @Environment(\.dismiss) var dismiss
    
    let imageNames: [String]
    private var topPadding: CGFloat
    @State private var selectedIndex: Int = 0
    
    init(imageNames: [String], selectedIndex: Int) {
        self.imageNames = imageNames
        self.topPadding = Constants.buttonCornerPadding*2
        
        if (UIDevice.current.hasDynamicIsland) {
            self.topPadding *= 2
        }
        
        _selectedIndex = State(initialValue: selectedIndex)
    }
    
    var body: some View {
        TabView(selection: $selectedIndex) {
            ForEach(0..<imageNames.count, id: \.self) { index in
                EVYZoomableContainer{
                    Image("\(imageNames[index])")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                }.background(Color.black)
            }
        }
        .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
        .overlay {
            VStack {
                Button(action: { dismiss()} ) {
                    Label("", systemImage: "xmark")
                        .foregroundColor(.white)
                        .font(.buttonFont)
                }
                .padding(EdgeInsets(top: self.topPadding,
                                    leading: Constants.buttonCornerPadding,
                                    bottom: 0,
                                    trailing: 0))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                
                HStack {
                    ForEach(0..<imageNames.count, id: \.self) { index in
                        Capsule()
                            .fill(Color.white.opacity(selectedIndex == index ? 1 : 0.33))
                            .frame(width: 35, height: 8)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                .padding()
            }
        }
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        .ignoresSafeArea()
    }
}

#Preview {
    EVYCarouselOverlay(imageNames: ["printer", "printer"], selectedIndex: 0)
}
