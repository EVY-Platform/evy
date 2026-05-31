//
//  EVYPhotoGalleryTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYPhotoGalleryTests: XCTestCase {
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
