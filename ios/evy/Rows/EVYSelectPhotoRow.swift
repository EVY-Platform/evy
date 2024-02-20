//
//  EVYSelectPhotoRow.swift
//  evy
//
//  Created by Clemence Chalot on 18/02/2024.
//


import SwiftUI
import PhotosUI

struct EVYSelectPhotoRowView: Decodable {
    let content: ContentData
    
    struct ContentData: Decodable {
        let title: String
        let icon: String
        let subtitle: String
        let content: String
        let photo_ids: String
    }
}

struct EVYSelectPhotoRow: View {
    public static var JSONType = "SelectPhoto"
    private let view: EVYSelectPhotoRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSelectPhotoRowView.self, forKey: .view)
    }

    @State private var selectedItem: PhotosPickerItem?
    @State private var image: UIImage?

    var body: some View {
        VStack {
            if view.content.title.count > 0 {
                EVYText(view.content.title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, Constants.textLinePadding)
            }

            VStack {
                PhotosPicker(
                    selection: $selectedItem,
                    label: {
                        VStack {
                            EVYText(view.content.icon)
                                .font(.titleFont)
                                .foregroundColor(Constants.placeholderColor)
                            EVYText(view.content.subtitle)
                                .font(.titleFont)
                                .foregroundColor(Constants.placeholderColor)
                        }
                        .padding(.vertical, 80)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .background(
                            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                                .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
                        )
                    }
                )
                .onChange(of: selectedItem) {
                    Task {
                        do {
                            if let data = try await selectedItem?.loadTransferable(type: Data.self) {
                                image = UIImage(data: data)
                            }
                        } catch {
                            print("Failed to load the image")
                        }
                    }
                }

                if let image = image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                }
            }

            EVYText(view.content.content)
                .font(.detailFont)
                .foregroundColor(Constants.placeholderColor)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
    }
}

struct EVYSelectPhotoRow_Previews: PreviewProvider {
    static var previews: some View {
        let json = SDUIConstants.selectPhotoRow.data(using: .utf8)!
        return try? JSONDecoder().decode(EVYRow.self, from: json)
    }
}
