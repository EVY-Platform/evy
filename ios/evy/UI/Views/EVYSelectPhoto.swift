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
        fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
     }
    
    @State private var photos: [String] = []

    init(title: String?,
         subtitle: String,
         icon: String,
         content: String,
         data: String,
         destination: String) throws
    {
        self.title = title
        self.icon = icon
        self.title = title
        self.content = content
        self.subtitle = subtitle
        self.destination = destination
        
        let props = try EVY.getValueFromText(data)
        if let photosData = props.value.data(using: .utf8) {
            let photoObjects = try JSONDecoder().decode([String].self, from: photosData)
            _photos = State(initialValue: photoObjects)
        }
    }

    var body: some View {
        VStack(alignment:.leading) {
            if title?.count ?? 0 > 0 {
                EVYTextView(title!)
            }

            if photos.count > 0 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        EVYSelectPhotoCarousel(imageNames: photos)
                        EVYSelectPhotoButton(fullScreen: false,
                                             icon: icon,
											 content: content,
                                             photos: $photos)
                    }
                }
            } else {
                EVYSelectPhotoButton(fullScreen: true,
                                     icon: icon,
									 content: content,
                                     photos: $photos)
            }
            
			EVYTextView(subtitle, style: .info)
                .padding(.vertical, Constants.padding)
        }
    }
}

struct EVYSelectPhotoButton: View {
    let fullScreen: Bool
    let icon: String
    let content: String
    
    @State private var selectedItem: PhotosPickerItem?
    @Binding var photos: [String]
    
    var body: some View {
        
        HStack {
            PhotosPicker(
                selection: $selectedItem,
                label: {
                    let stack = VStack {
                        EVYTextView(icon)
                        EVYTextView(content)
                    }
                    if fullScreen {
                        stack
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 80)
                            .background(
                                RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                                    .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth))
                    } else {
                        stack
                            .frame(width: carouselElementSize, height: carouselElementSize)
                            .background(
                                RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
                                    .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth))
                    }
                }
            )
			.buttonStyle(.plain)
            .onChange(of: selectedItem) {
                Task {
                    do {
                        if let data = try await selectedItem?.loadTransferable(type: Data.self) {
                            let id = UUID().description
                            try ImageManager().writeImage(name: id, data: data)
                            photos.append(id)
                        }
                    } catch {
                        #if DEBUG
                        print("[EVYSelectPhoto] Failed to load image: \(error)")
                        #endif
                        NotificationCenter.default.post(
                            name: Notification.Name.evyErrorOccurred,
                            object: EVYError.imageLoadFailed(name: "selected photo")
                        )
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
            if let image = try? ImageManager().getImage(name: imageNames[index]) {
                image
                    .resizable()
                    .scaledToFill()
                    .frame(width: carouselElementSize, height: carouselElementSize)
                    .clipShape(RoundedRectangle(cornerRadius: Constants.mainCornerRadius))
                    .padding(.horizontal, 2)
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: carouselElementSize, height: carouselElementSize)
                    .clipShape(RoundedRectangle(cornerRadius: Constants.mainCornerRadius))
                    .padding(.horizontal, 2)
            }
        }
    }
}

class ImageManager {
    static let shared = ImageManager()
    let fm = FileManager.default
    var cachesDirectoryUrl: URL {
		fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
    }
    
    func getImage(name: String) throws -> Image {
        let fileUrl = cachesDirectoryUrl.appendingPathComponent("\(name).png")
        let filePath = fileUrl.path
        if fm.fileExists(atPath: filePath) {
            let data = try Data(contentsOf: fileUrl)
            guard let uiImage = UIImage(data: data) else {
                throw EVYError.imageLoadFailed(name: name)
            }
            return Image(uiImage: uiImage)
        }
        guard let uiImage = UIImage(named: "\(name).png") else {
            throw EVYError.imageLoadFailed(name: name)
        }
        return Image(uiImage: uiImage)
    }
    
    func writeImage(name: String, data: Data) throws {
        guard let uiImage = UIImage(data: data) else {
            throw EVYError.imageLoadFailed(name: name)
        }
        guard let pngData = uiImage.pngData() else {
            throw EVYError.imageLoadFailed(name: name)
        }
        let fileUrl = cachesDirectoryUrl.appendingPathComponent("\(name).png")
        try pngData.write(to: fileUrl)
    }
}

#Preview {
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.createItem()
		
		return try EVYSelectPhoto(title: "Photos Title",
							  subtitle: "Photos: {count(item.photo_ids)}/10 - Chose your listing’s main photo first.",
							  icon: "::photo.badge.plus.fill::",
							  content: "A great subtitle",
							  data: "{item.photo_ids}",
							  destination: "{item.photo_ids}")
	}
}
