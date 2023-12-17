//
//  FCarousel.swift
//  EVY
//
//  Created by Geoffroy Lesage on 6/12/2023.
//

import SwiftUI

struct EVYCarouselRow: View {
    public static var JSONType = "Carousel"
    private struct JSONData: Decodable {
        let photo_ids: [String]
    }
    
    private let imageNames: [String]
    
    @State private var selectedImageIndex: Int = 0
    @State private var showFullScreen = false
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.imageNames = parsedData.photo_ids
    }
    
    var body: some View {
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
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .padding()
        }
        .fullScreenCover(isPresented: $showFullScreen,
                         onDismiss: { showFullScreen = false },
                         content: {EVYCarouselOverlay(imageNames: imageNames,
                                                      selectedIndex: selectedImageIndex)})
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        .frame(height: 300)
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
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
