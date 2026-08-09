//
//  EVYDataChangeNotificationTests.swift
//  evyTests
//

import SwiftUI
import XCTest

@testable import evy

@MainActor
final class EVYDataChangeNotificationTests: XCTestCase {

  func testCreatePostsRecordChangePayload() throws {
    let store = EVYDataStore(name: UUID().uuidString, inMemoryOnly: true)
    let namespace = EVYNamespace.evy
    let resource = EVYCoreResource.rows.ref
    let id = UUID().uuidString

    var receivedChanges: [EVYRecordChange] = []

    let token = NotificationCenter.default.addObserver(
      forName: .evyRecordChanged, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        if let change = EVYRecordChange.from(notification) {
          receivedChanges.append(change)
        }
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    let data = try JSONSerialization.data(withJSONObject: ["id": id])
    try store.create(namespace: namespace, resource: resource, id: id, value: data)

    let matchingChange = receivedChanges.first
    XCTAssertEqual(matchingChange?.namespace, namespace)
    XCTAssertEqual(matchingChange?.resource, resource)
    XCTAssertEqual(matchingChange?.id, id)
    XCTAssertEqual(matchingChange?.recordKey, "\(namespace):\(resource):\(id)")
  }

  func testCreatePostsValueChangeForResourceWatchKey() throws {
    let store = EVYDataStore(name: UUID().uuidString, inMemoryOnly: true)
    let namespace = EVYNamespace.evy
    let resource = EVYCoreResource.rows.ref
    let id = UUID().uuidString

    var receivedKeys: [String] = []

    let token = NotificationCenter.default.addObserver(
      forName: .evyValueChanged, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        if let key = notification.object as? String {
          receivedKeys.append(key)
        }
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    let data = try JSONSerialization.data(withJSONObject: ["id": id])
    try store.create(namespace: namespace, resource: resource, id: id, value: data)

    XCTAssertEqual(receivedKeys, [resource])
  }

  /// Incoming synced records must refresh page-scope cache snapshots of the
  /// same entity and notify their watchers; redelivery of an identical record
  /// must stay silent.
  func testApplySyncedValueRefreshesCacheSnapshots() throws {
    let namespace = MarketplaceTestFixture.service
    let resource = "\(namespace).snapshot_items"
    let scopeId = "scope-\(UUID().uuidString)"
    let itemId = UUID().uuidString

    func item(titled title: String) -> EVYJson {
      .dictionary(["id": .string(itemId), "title": .string(title)])
    }

    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: scopeId, id: resource,
      value: try JSONEncoder().encode(item(titled: "Stale")), sortIndex: 3)
    defer {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: scopeId)
      try? EVY.publicStore.deleteAll(namespace: namespace, resource: resource)
    }

    var receivedKeys: [String] = []
    let token = NotificationCenter.default.addObserver(
      forName: .evyValueChanged, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        if let key = notification.object as? String {
          receivedKeys.append(key)
        }
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    try EVY.applySyncedValue(namespace: namespace, resource: resource, value: item(titled: "Fresh"))

    let cachedRow = try EVY.cacheStore.get(
      namespace: EVYNamespace.cache, resource: scopeId, id: resource)
    XCTAssertEqual(try cachedRow.decoded(), item(titled: "Fresh"))
    XCTAssertEqual(cachedRow.sortIndex, 3, "The snapshot's sortIndex must be preserved")
    // The synced upsert posts the resource key once; the snapshot refresh must
    // post it a second time so page bindings recompute.
    XCTAssertEqual(
      receivedKeys.filter { $0 == resource }.count, 2,
      "Watchers key off the cache row id (the resource ref), got: \(receivedKeys)")

    receivedKeys = []
    try EVY.applySyncedValue(namespace: namespace, resource: resource, value: item(titled: "Fresh"))
    XCTAssertEqual(
      receivedKeys.filter { $0 == resource }.count, 1,
      "Redelivering an identical record must not rewrite the snapshot, got: \(receivedKeys)")
  }

  func testFromExtractsPayloadOrReturnsNil() {
    let change = EVYRecordChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.pages.ref,
      id: "page-1"
    )
    let notificationWithPayload = Notification(
      name: .evyRecordChanged,
      object: change.recordKey,
      userInfo: [EVYRecordChange.userInfoKey: change]
    )
    XCTAssertEqual(EVYRecordChange.from(notificationWithPayload), change)

    let notificationWithoutPayload = Notification(
      name: .evyValueChanged,
      object: EVYCoreResource.rows.ref,
      userInfo: nil
    )
    XCTAssertNil(EVYRecordChange.from(notificationWithoutPayload))
  }
}
