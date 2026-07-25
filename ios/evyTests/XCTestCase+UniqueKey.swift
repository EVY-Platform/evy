//
//  XCTestCase+UniqueKey.swift
//  evyTests
//

import XCTest

@testable import evy

extension XCTestCase {
  @MainActor
  func installHermeticMutationSync() {
    EVY.syncTransport = { _, _ in }
  }

  @MainActor
  func resetHermeticMutationSync() {
    EVY.syncTransport = nil
  }

  func uniqueKey(_ suffix: String) -> String {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    return "evy_test_\(suffix)_\(randomId)"
  }

  /// Builds an action from the compact call syntax. Storage is structured, so
  /// the strings are converted here rather than persisted.
  @MainActor
  func rowAction(
    condition: String = "",
    true trueBranch: String,
    false falseBranch: String = ""
  ) -> UI_RowAction {
    UI_RowAction(
      condition: condition,
      false: branch(falseBranch),
      true: branch(trueBranch)
    )
  }

  @MainActor
  func branch(_ legacyCallSyntax: String) -> EVYActionBranch {
    let trimmed = legacyCallSyntax.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return .empty }
    guard let invocation = try? EVYActionParser.invocation(from: trimmed) else {
      return .empty
    }
    return .invocation(invocation)
  }
}
