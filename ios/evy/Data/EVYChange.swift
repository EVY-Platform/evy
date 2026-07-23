//
//  EVYChange.swift
//  evy
//

import Foundation

extension Notification.Name {
  static let evyRecordChanged = Notification.Name("EVYRecordChanged")
  static let evyValueChanged = Notification.Name("EVYValueChanged")
  static let evyErrorOccurred = Notification.Name("EVYErrorOccurred")
  static let evyExpandTextRow = Notification.Name("EVYExpandTextRow")
}

struct EVYRecordChange: Equatable {
  static let userInfoKey = "evyRecordChange"
  let namespace: String
  let resource: String
  let id: String

  var recordKey: String { "\(namespace):\(resource):\(id)" }

  func matches(namespace: String, resource: String, id: String) -> Bool {
    self.namespace == namespace && self.resource == resource && self.id == id
  }

  static func from(_ notification: Notification) -> EVYRecordChange? {
    notification.userInfo?[userInfoKey] as? EVYRecordChange
  }
}

struct EVYValueChange: Equatable {
  let key: String?

  static func post(key: String?) {
    NotificationCenter.default.post(name: .evyValueChanged, object: key)
  }

  init(key: String?) {
    self.key = key
  }

  init(notification: Notification) {
    key = notification.object as? String
  }

  func affects(watchSegments: [String]) -> Bool {
    guard let key else { return true }
    guard !watchSegments.isEmpty else { return false }
    let notificationSegments = key.components(separatedBy: PROP_SEPARATOR)
    let comparedSegmentCount = min(watchSegments.count, notificationSegments.count)
    return watchSegments.prefix(comparedSegmentCount)
      == notificationSegments.prefix(comparedSegmentCount)
  }
}
