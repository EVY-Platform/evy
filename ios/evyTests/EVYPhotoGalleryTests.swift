//
//  EVYPhotoGalleryTests.swift
//  evyTests
//

import UIKit
import XCTest

@testable import evy

@MainActor
final class EVYPhotoGalleryTests: XCTestCase {
  func testNormalizeToJPEGProducesDecodableJPEG() throws {
    let size = CGSize(width: 10, height: 10)
    let sourceImage = UIGraphicsImageRenderer(size: size).image { context in
      UIColor.red.setFill()
      context.fill(CGRect(origin: .zero, size: size))
    }
    guard let pngData = sourceImage.pngData() else {
      XCTFail("Failed to create PNG data")
      return
    }

    let jpegData = try EVYFileCache.normalizeToJPEG(pngData)
    XCTAssertFalse(jpegData.isEmpty)
    XCTAssertNotNil(UIImage(data: jpegData))
  }

  func testFileCachePathIsUnderAppSupport() {
    let path = EVYFileCache.filePath(for: "test-id")
    let appSupportRoot = FileManager.default
      .urls(for: .applicationSupportDirectory, in: .userDomainMask)
      .first!
      .path
    XCTAssertTrue(
      path.path.hasPrefix(appSupportRoot),
      "Expected app support path, got: \(path.path)"
    )
    XCTAssertTrue(
      path.path.contains("/Files/"),
      "Expected file cache path, got: \(path.path)"
    )
  }
}
