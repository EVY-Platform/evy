//
//  FCarousel.swift
//  frodo
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct EVYCarouselRow: View, Decodable {
    public static var JSONType = "Carousel"
    
    let photo_ids: [String]
    
    @State private var selectedImageIndex: Int = 0
    @State private var showFullScreen = false
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let parsedData = try container.decode(Self.self, forKey:.content)
        self.photo_ids = parsedData.photo_ids
    }
    
    var body: some View {
        TabView(selection: $selectedImageIndex) {
            ForEach(0..<photo_ids.count, id: \.self) { index in
                Image("\(photo_ids[index])")
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
                ForEach(0..<photo_ids.count, id: \.self) { index in
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
        .fullScreenCover(isPresented: $showFullScreen,
                         onDismiss: { showFullScreen = false },
                         content: {EVYCarouselOverlay(imageNames: photo_ids,
                                                      selectedIndex: selectedImageIndex)})
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
    }
}

#Preview {
    let json = """
    {
        "type": "Carousel",
        "content": {
            "photo_ids": ["printer_logo", "printer"]
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYCarouselRow.self, from: json)
}
