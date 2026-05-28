//
//  EVYImageCache.swift
//  evy
//

import SwiftUI

struct EVYImageCache {
  private static let fm = FileManager.default

  private static var cacheDir: URL {
    fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
  }

  static func filePath(for id: String) -> URL {
    cacheDir.appendingPathComponent("\(id).jpg")
  }

  static func write(imageId: String, jpegData: Data) throws {
    try jpegData.write(to: filePath(for: imageId))
  }

  static func read(imageId: String) -> Data? {
    try? Data(contentsOf: filePath(for: imageId))
  }

  static func remove(imageId: String) {
    let path = filePath(for: imageId)
    guard fm.fileExists(atPath: path.path) else { return }
    try? fm.removeItem(at: path)
  }

  static func swiftUIImage(for imageId: String) -> Image? {
    guard let data = read(imageId: imageId),
      let uiImage = UIImage(data: data)
    else { return nil }
    return Image(uiImage: uiImage)
  }

  static func normalizeToJPEG(_ rawData: Data) throws -> Data {
    guard let uiImage = UIImage(data: rawData) else {
      throw EVYError.imageLoadFailed(name: "normalization")
    }
    let uprightImage = uprightRasterizedImage(from: uiImage)
    guard let jpegData = uprightImage.jpegData(compressionQuality: 0.85) else {
      throw EVYError.imageLoadFailed(name: "normalization")
    }
    return jpegData
  }

  private static func uprightRasterizedImage(from image: UIImage) -> UIImage {
    guard image.imageOrientation != .up else {
      return image
    }

    let rendererFormat = UIGraphicsImageRendererFormat.default()
    rendererFormat.scale = image.scale
    rendererFormat.opaque = false

    return UIGraphicsImageRenderer(size: image.size, format: rendererFormat).image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }
  }
}
