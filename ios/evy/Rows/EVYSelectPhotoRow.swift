//
//  EVYSelectPhotoRow.swift
//  evy
//
//  Created by Clemence Chalot on 18/02/2024.
//


import SwiftUI
import PhotosUI

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
    private var fm = FileManager.default
    private var cacheDir: URL {
        let urls = fm.urls(for: .cachesDirectory,
                                            in: .userDomainMask)
        return urls[0]
     }
    
    @State var photos: [String] = []

    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYSelectPhotoRowView.self, forKey:.view)
        
        do {
            let (_, data) = parseData(self.view.content.photos)!
            let photosData = data.data(using: .utf8)!
            let photoObjects = try JSONDecoder().decode([EVYPhoto].self, from:photosData)
            self.photos.append(contentsOf: photoObjects.map { $0.id })
        } catch {}
    }

    var body: some View {
        VStack(spacing: Constants.textLinePadding) {
            if view.content.title.count > 0 {
                EVYTextView(view.content.title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if photos.count > 0 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        EVYSelectPhotoCarousel(imageNames: photos)
                        EVYSelectPhotoButton(fullScreen: false,
                                             icon: view.content.icon,
                                             subtitle: view.content.subtitle,
                                             photos: $photos)
                    }
                }
            } else {
                EVYSelectPhotoButton(fullScreen: true,
                                     icon: view.content.icon,
                                     subtitle: view.content.subtitle,
                                     photos: $photos)
            }
            
            EVYTextView(view.content.content)
                .font(.detailFont)
                .foregroundColor(Constants.placeholderColor)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Constants.majorPadding)
        }
    }
}

struct EVYSelectPhotoButton: View {
    let fullScreen: Bool
    let icon: String
    let subtitle: String
    
    @State private var selectedItem: PhotosPickerItem?
    @Binding var photos: [String]
    
    var body: some View {
        
        HStack {
            PhotosPicker(
                selection: $selectedItem,
                label: {
                    let stack = VStack {
                        EVYTextView(icon)
                            .font(.titleFont)
                            .foregroundColor(Constants.placeholderColor)
                        EVYTextView(subtitle)
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
                            .padding(.horizontal, Constants.majorPadding)
                    } else {
                        stack
                            .frame(width: carouselElementSize, height: carouselElementSize)
                            .background(
                                RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                                    .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth))
                    }
                }
            )
            .onChange(of: selectedItem) {
                Task {
                    do {
                        if let data = try await selectedItem?.loadTransferable(type: Data.self) {
                            let id = UUID().description
                            ImageManager().writeImage(name: id,
                                                      uiImage: UIImage(data: data)!)
                            photos.append(id)
                        }
                    } catch {
                        print("Failed to load the image")
                    }
                }
            }
        }
    }
}

struct EVYSelectPhotoCarousel: View {
    let imageNames: [String]
    
    var body: some View {
        ForEach(0..<imageNames.count, id: \.self) { index in
            ImageManager().getImage(name: imageNames[index])!
                .resizable()
                .scaledToFill()
                .frame(width: carouselElementSize, height: carouselElementSize)
                .clipShape(RoundedRectangle(cornerRadius: Constants.mainCornerRadius))
                .padding(.horizontal, Constants.minPadding)
        }
    }
}

class ImageManager {
    static var shared = ImageManager()
    var fm = FileManager.default
    var cachesDirectoryUrl: URL {
        let urls = fm.urls(for: .cachesDirectory, in: .userDomainMask)
        return urls[0]
    }
    
    init() {
        print(cachesDirectoryUrl)
    }
    
    func getImage(name: String) -> Image? {
        let fileUrl = cachesDirectoryUrl.appendingPathComponent("\(name).png")
        let filePath = fileUrl.path
        if fm.fileExists(atPath: filePath),
           let data = try? Data(contentsOf: fileUrl){
            return Image(uiImage: UIImage(data: data)!)
        }
        return nil
    }
    
    func writeImage(name: String, uiImage: UIImage) {
        let data = uiImage.pngData()
        let fileUrl = cachesDirectoryUrl.appendingPathComponent("\(name).png")
        let filePath = fileUrl.path
        fm.createFile(atPath: filePath, contents: data)
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    EVYParser.instance.create(id: "item", data: item)
    
    let json =  SDUIConstants.selectPhotoRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
