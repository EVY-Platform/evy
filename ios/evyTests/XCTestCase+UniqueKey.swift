//
//  XCTestCase+UniqueKey.swift
//  evyTests
//

import XCTest

@testable import evy

extension XCTestCase {
  func uniqueKey(_ suffix: String) -> String {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    return "evy_test_\(suffix)_\(randomId)"
  }

  func rowAction(
    condition: String = "",
    true trueBranch: String,
    false falseBranch: String = ""
  ) -> UI_RowAction {
    UI_RowAction(
      condition: condition,
      false: falseBranch,
      true: trueBranch
    )
  }
}
