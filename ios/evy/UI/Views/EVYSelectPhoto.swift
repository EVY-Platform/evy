//
//  EVYSelectPhoto.swift
//  evy
//
//  Created by Geoffroy Lesage on 28/06/2024.
//


import SwiftUI
import PhotosUI

var carouselElementSize: CGFloat = 150.0

struct EVYSelectPhoto: View {
    var title: String?
    let subtitle: String
    let icon: String
    let content: String
    let destination: String
    
    private var options: EVYJsonArray = []
    
    @State private var selection: EVYJson?
    @State private var showSheet = false
    
    private let fm = FileManager.default
    private var cacheDir: URL {
        return fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
     }
    
    @State private var photos: [String] = []

    init(title: String?,
         subtitle: String,
         icon: String,
         content: String,
         data: String,
         destination: String)
    {
        self.title = title
        self.icon = icon
        self.title = title
        self.content = content
        self.subtitle = subtitle
        self.destination = destination
        
        do {
            let props = EVY.getValueFromText(data)
            if let photosData = props.value.data(using: .utf8) {
                let photoObjects = try JSONDecoder().decode([String].self, from:photosData)
                _photos = State(initialValue: photoObjects)
            }
           } catch {}
    }

    var body: some View {
        VStack(alignment:.leading) {
            if self.title?.count ?? 0 > 0 {
                EVYTextView(title!)
            }

            if photos.count > 0 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        EVYSelectPhotoCarousel(imageNames: photos)
                        EVYSelectPhotoButton(fullScreen: false,
                                             icon: icon,
                                             subtitle: subtitle,
                                             photos: $photos)
                    }
                }
            } else {
                EVYSelectPhotoButton(fullScreen: true,
                                     icon: icon,
                                     subtitle: subtitle,
                                     photos: $photos)
            }
            
            EVYTextView(content)
                .foregroundColor(Constants.textColor)
                .padding(.vertical, Constants.padding)
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
                            .foregroundColor(Constants.textColor)
                        EVYTextView(subtitle)
                            .foregroundColor(Constants.textColor)
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
                .padding(.horizontal, 2)
        }
    }
}

class ImageManager {
    static let shared = ImageManager()
    let fm = FileManager.default
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
        return Image(uiImage: UIImage(named: "\(name).png")!)
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
    try! EVY.data.create(key: "item", data: item)
    
    return EVYSelectPhoto(title: "Photos Title",
                          subtitle: "A great subtitle",
                          icon: "::photo.badge.plus.fill::",
                          content: "Photos: {count(item.photo_ids)}/10 - Chose your listing’s main photo first.",
                          data: "{item.photo_ids}",
                          destination: "{item.photo_ids}")
}
