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
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_").lowercased()
    return "evy_test_\(suffix)_\(randomId)"
  }

  /// Builds an action from structured invocations, the only form that is
  /// stored or executed.
  func rowAction(
    condition: String = "",
    true trueBranch: EVYActionInvocation?,
    false falseBranch: EVYActionInvocation? = nil
  ) -> UI_RowAction {
    UI_RowAction(
      condition: condition,
      false: branch(falseBranch),
      true: branch(trueBranch)
    )
  }

  func branch(_ invocation: EVYActionInvocation?) -> EVYActionBranch {
    invocation.map(EVYActionBranch.invocation) ?? .empty
  }
}
