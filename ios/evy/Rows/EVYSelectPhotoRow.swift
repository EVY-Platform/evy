//
//  EVYSelectPhotoRow.swift
//  evy
//
//  Created by Clemence Chalot on 18/02/2024.
//



import SwiftUI

var carouselElementSize: CGFloat = 150.0

struct EVYSelectPhotoRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let icon: String
        let subtitle: String
        let content: String
        let photos: String
    }
}

struct EVYPhoto: Decodable {
    let id: String
}

struct EVYSelectPhotoRow: View {
    public static var JSONType = "SelectPhoto"
    
    private let view: EVYSelectPhotoRowView
    private var photos: [String] = []
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSelectPhotoRowView.self, forKey:.view)
        
        do {
            let (_, data) = parseEVYData(self.view.content.photos)!
            let photosData = data.data(using: .utf8)!
            let photoObjects = try JSONDecoder().decode([EVYPhoto].self, from:photosData)
            self.photos = photoObjects.map { $0.id }
        } catch {}
    }
        
    var body: some View {
        VStack {
            if view.content.title.count > 0 {
                EVYText(view.content.title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, Constants.textLinePadding)
            }
            if photos.count > 0 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        EVYSelectPhotoCarousel(imageNames: photos)
                        EVYSelectPhotoButton(fullScreen: false,
                                             icon: view.content.icon,
                                             subtitle: view.content.subtitle)
                    }
                }
            } else {
                EVYSelectPhotoButton(fullScreen: true,
                                     icon: view.content.icon,
                                     subtitle: view.content.subtitle)
            }
            
            EVYText(view.content.content)
                .font(.detailFont)
                .foregroundColor(Constants.placeholderColor)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct EVYSelectPhotoButton: View {
    let fullScreen: Bool
    let icon: String
    let subtitle: String
    
    var body: some View {
        let stack = VStack {
            EVYText(icon)
                .font(.titleFont)
                .foregroundColor(Constants.placeholderColor)
            EVYText(subtitle)
                .font(.titleFont)
                .foregroundColor(Constants.placeholderColor)
        }
        if fullScreen {
            stack
            .frame(maxWidth: .infinity)
            .padding(.vertical, 80)
            .background(
                RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                    .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth))
        } else {
            stack
            .frame(width: carouselElementSize, height: carouselElementSize)
            .background(
                RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                    .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth))
        }
    }
}

struct EVYSelectPhotoCarousel: View {
    let imageNames: [String]
    
    var body: some View {
        ForEach(0..<imageNames.count, id: \.self) { index in
            Image("\(imageNames[index])")
                .resizable()
                .scaledToFill()
                .frame(width: carouselElementSize, height: carouselElementSize)
                .clipShape(RoundedRectangle(cornerRadius: Constants.mainCornerRadius))
                .padding(.horizontal, Constants.minPadding)
        }
    }
}

#Preview {
    let data = EVYData.shared
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)
    let json =  SDUIConstants.selectPhotoRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
