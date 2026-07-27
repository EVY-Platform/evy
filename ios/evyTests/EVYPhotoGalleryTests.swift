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

  func testImageIdsUsesPageCacheScopeAndIgnoresStringifiedObjects() throws {
    let itemsKey = "photo-gallery-items-\(UUID().uuidString)"
    let detailPageId = "detail-\(UUID().uuidString)"
    let homePageId = "home-\(UUID().uuidString)"
    let photoId = "photo-gallery-file-1"
    let item = EVYJson.dictionary([
      "id": .string("item-1"),
      "title": .string("Amazing Fridge"),
      "photo_ids": .array([.string(photoId)]),
    ])

    defer {
      try? EVY.publicStore.deleteAll(
        namespace: MarketplaceTestFixture.serviceId, resource: itemsKey)
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: detailPageId)
      EVY.activeCacheScopeId = nil
    }

    try EVY.publicStore.applySyncedValue(
      namespace: MarketplaceTestFixture.serviceId,
      resource: itemsKey,
      value: .array([item])
    )
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache,
      resource: detailPageId,
      id: itemsKey,
      value: try JSONEncoder().encode(item)
    )

    // Simulate navigating home while the view-item PhotoGallery is still alive: global scope
    // points at home, so `{items.photo_ids}` would otherwise resolve against the full
    // collection and stringify each item object as a fake image id.
    EVY.activeCacheScopeId = homePageId
    let unscoped = EVYPhotoGalleryRow.imageIds(
      from: "{\(itemsKey).photo_ids}",
      cacheScopeId: nil
    )
    XCTAssertEqual(unscoped, [], "Collection-level photo_ids must not become image ids")

    let scoped = EVYPhotoGalleryRow.imageIds(
      from: "{\(itemsKey).photo_ids}",
      cacheScopeId: detailPageId
    )
    XCTAssertEqual(scoped, [photoId])
  }
}
