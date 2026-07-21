//
//  EVYFileCache.swift
//  evy
//

import SwiftUI

struct EVYFileCache {
  private static let fm = FileManager.default

  private static var fileDirectory: URL {
    let appSupport = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let dir = appSupport.appendingPathComponent("Files", isDirectory: true)
    if !fm.fileExists(atPath: dir.path) {
      try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
    }
    return dir
  }

  static func filePath(for id: String) -> URL {
    fileDirectory.appendingPathComponent(id)
  }

  static func write(fileId: String, data: Data) throws {
    try data.write(to: filePath(for: fileId))
  }

  static func read(fileId: String) -> Data? {
    try? Data(contentsOf: filePath(for: fileId))
  }

  static func remove(fileId: String) {
    try? fm.removeItem(at: filePath(for: fileId))
  }

  static func swiftUIImage(for fileId: String) -> Image? {
    guard let data = read(fileId: fileId),
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
