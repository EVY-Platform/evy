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
    let resource = EVYCoreResource.rows.rawValue
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
    let resource = EVYCoreResource.rows.rawValue
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

  func testFromExtractsPayloadOrReturnsNil() {
    let change = EVYRecordChange(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.pages.rawValue,
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
      object: EVYCoreResource.rows.rawValue,
      userInfo: nil
    )
    XCTAssertNil(EVYRecordChange.from(notificationWithoutPayload))
  }
}
