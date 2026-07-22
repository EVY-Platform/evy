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

  static func toggledIdentifiers(
    _ batch: [String],
    in selections: [String]
  ) -> [String] {
    guard !batch.isEmpty else { return selections }
    let batchSet = Set(batch)
    if batch.allSatisfy({ selections.contains($0) }) {
      return selections.filter { !batchSet.contains($0) }
    }
    var updated = selections
    let existing = Set(selections)
    for identifier in batch where !existing.contains(identifier) {
      updated.append(identifier)
    }
    return updated
  }
}
