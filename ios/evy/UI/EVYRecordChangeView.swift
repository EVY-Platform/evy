//
//  EVYRecordChangeView.swift
//  evy
//

import SwiftUI

extension View {
  func onEVYRecordChange(
    namespace: String,
    resource: String,
    id: String,
    perform action: @escaping () -> Void
  ) -> some View {
    onEVYRecordChange(namespace: namespace, resource: resource, ids: Set([id]), perform: action)
  }

  func onEVYRecordChange(
    namespace: String,
    resource: String,
    ids: Set<String>,
    perform action: @escaping () -> Void
  ) -> some View {
    onReceive(NotificationCenter.default.publisher(for: .evyRecordChanged)) { notification in
      guard
        let change = EVYRecordChange.from(notification),
        change.namespace == namespace,
        change.resource == resource,
        ids.contains(change.id)
      else { return }
      action()
    }
  }
}
