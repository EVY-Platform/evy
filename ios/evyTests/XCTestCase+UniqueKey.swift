//
//  XCTestCase+UniqueKey.swift
//  evyTests
//

import XCTest

extension XCTestCase {
  func uniqueKey(_ suffix: String) -> String {
    let randomId = UUID().uuidString.replacingOccurrences(of: "-", with: "_")
    return "evy_test_\(suffix)_\(randomId)"
  }
}
