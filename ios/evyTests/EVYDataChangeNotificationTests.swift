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

  func testNonIdQualifiedPostsHaveNoPayload() throws {
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

    let nonIdQualifiedObjectKeys = [resource, "\(namespace):\(resource)"]
    for objectKey in nonIdQualifiedObjectKeys {
      let notification = receivedNotifications.first {
        ($0.object as? String) == objectKey
      }
      XCTAssertNotNil(
        notification,
        "Expected a notification with object == \"\(objectKey)\""
      )
      XCTAssertNil(
        notification?.userInfo?[EVYDataChange.userInfoKey],
        "Notification with object == \"\(objectKey)\" should not carry an EVYDataChange payload"
      )
    }
  }

  func testFromExtractsPayloadOrReturnsNil() {
    let change = EVYDataChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.pages.rawValue,
      id: "page-1"
    )
    let notificationWithPayload = Notification(
      name: .evyDataChanged,
      object: change.recordKey,
      userInfo: [EVYDataChange.userInfoKey: change]
    )
    XCTAssertEqual(EVYDataChange.from(notificationWithPayload), change)

    let notificationWithoutPayload = Notification(
      name: .evyDataChanged,
      object: EVYCoreResource.rows.rawValue,
      userInfo: nil
    )
    XCTAssertNil(EVYDataChange.from(notificationWithoutPayload))
  }
}
