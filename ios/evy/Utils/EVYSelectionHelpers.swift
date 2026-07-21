//
//  EVYSelectionHelpers.swift
//  evy
//

import Foundation

@MainActor
enum EVYSelectionHelpers {
  static func toggledIdentifier(
    _ identifier: String,
    in selected: [String]
  ) -> [String] {
    var updated = selected.filter { $0 != identifier }
    if updated.count == selected.count {
      updated.append(identifier)
    }
    return updated
  }
}
