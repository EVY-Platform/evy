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
    onReceive(NotificationCenter.default.publisher(for: .evyRecordChanged)) { notification in
      guard
        let change = EVYRecordChange.from(notification),
        change.matches(namespace: namespace, resource: resource, id: id)
      else { return }
      action()
    }
  }
}
