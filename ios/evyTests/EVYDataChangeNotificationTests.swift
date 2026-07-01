//
//  EVYDataChangeNotificationTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYDataChangeNotificationTests: XCTestCase {

  func testCreatePostsIdQualifiedChangePayload() throws {
    let store = EVYDataStore(name: UUID().uuidString, inMemoryOnly: true)
    let namespace = EVYNamespace.evy
    let resource = EVYCoreResource.rows.rawValue
    let id = UUID().uuidString

    var receivedNotifications: [Notification] = []
    let expectation = expectation(
      description: "Receives id-qualified data change with EVYDataChange payload")

    let token = NotificationCenter.default.addObserver(
      forName: .evyDataChanged, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        receivedNotifications.append(notification)
        if notification.userInfo?[EVYDataChange.userInfoKey] as? EVYDataChange != nil {
          expectation.fulfill()
        }
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    let data = try JSONSerialization.data(withJSONObject: ["id": id])
    try store.create(namespace: namespace, resource: resource, id: id, value: data)

    wait(for: [expectation], timeout: 1.0)

    let matchingChange = receivedNotifications.compactMap {
      $0.userInfo?[EVYDataChange.userInfoKey] as? EVYDataChange
    }.first

    XCTAssertNotNil(matchingChange)
    XCTAssertEqual(matchingChange?.namespace, namespace)
    XCTAssertEqual(matchingChange?.resource, resource)
    XCTAssertEqual(matchingChange?.id, id)
    XCTAssertEqual(matchingChange?.recordKey, "\(namespace):\(resource):\(id)")
  }

  func testBareResourcePostHasNoPayload() throws {
    let store = EVYDataStore(name: UUID().uuidString, inMemoryOnly: true)
    let namespace = EVYNamespace.evy
    let resource = EVYCoreResource.rows.rawValue
    let id = UUID().uuidString

    var receivedNotifications: [Notification] = []

    let token = NotificationCenter.default.addObserver(
      forName: .evyDataChanged, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        receivedNotifications.append(notification)
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    let data = try JSONSerialization.data(withJSONObject: ["id": id])
    try store.create(namespace: namespace, resource: resource, id: id, value: data)

    let bareResourceNotification = receivedNotifications.first {
      ($0.object as? String) == resource
    }
    XCTAssertNotNil(
      bareResourceNotification,
      "Expected a notification with object == \"\(resource)\""
    )
    XCTAssertNil(
      bareResourceNotification?.userInfo?[EVYDataChange.userInfoKey],
      "Bare resource notification should not carry an EVYDataChange payload"
    )
  }

  func testNamespaceResourcePostHasNoPayload() throws {
    let store = EVYDataStore(name: UUID().uuidString, inMemoryOnly: true)
    let namespace = EVYNamespace.evy
    let resource = EVYCoreResource.rows.rawValue
    let id = UUID().uuidString

    var receivedNotifications: [Notification] = []

    let token = NotificationCenter.default.addObserver(
      forName: .evyDataChanged, object: nil, queue: nil
    ) { notification in
      MainActor.assumeIsolated {
        receivedNotifications.append(notification)
      }
    }
    defer { NotificationCenter.default.removeObserver(token) }

    let data = try JSONSerialization.data(withJSONObject: ["id": id])
    try store.create(namespace: namespace, resource: resource, id: id, value: data)

    let namespaceResourceKey = "\(namespace):\(resource)"
    let namespaceResourceNotification = receivedNotifications.first {
      ($0.object as? String) == namespaceResourceKey
    }
    XCTAssertNotNil(
      namespaceResourceNotification,
      "Expected a notification with object == \"\(namespaceResourceKey)\""
    )
    XCTAssertNil(
      namespaceResourceNotification?.userInfo?[EVYDataChange.userInfoKey],
      "Namespace:resource notification should not carry an EVYDataChange payload"
    )
  }

  func testMatchesReturnsTrueForExactRecord() {
    let change = EVYDataChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.rawValue,
      id: "row-1"
    )
    XCTAssertTrue(
      change.matches(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.rows.rawValue,
        id: "row-1"
      )
    )
  }

  func testMatchesReturnsFalseWhenIdDiffers() {
    let change = EVYDataChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.rawValue,
      id: "row-1"
    )
    XCTAssertFalse(
      change.matches(
        namespace: EVYNamespace.evy,
        resource: EVYCoreResource.rows.rawValue,
        id: "row-2"
      )
    )
  }

  func testFromExtractsPayloadFromNotification() {
    let change = EVYDataChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.pages.rawValue,
      id: "page-1"
    )
    let notification = Notification(
      name: .evyDataChanged,
      object: change.recordKey,
      userInfo: [EVYDataChange.userInfoKey: change]
    )
    XCTAssertEqual(EVYDataChange.from(notification), change)
  }

  func testFromReturnsNilWhenPayloadMissing() {
    let notification = Notification(
      name: .evyDataChanged,
      object: EVYCoreResource.rows.rawValue,
      userInfo: nil
    )
    XCTAssertNil(EVYDataChange.from(notification))
  }
}
