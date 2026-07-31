//
//  Color+Hex.swift
//  evy
//

import SwiftUI

extension Color {
  /// Parses `#RRGGBB` hex strings. Returns nil for blank or malformed input.
  init?(hex: String) {
    let trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.count == 7, trimmed.hasPrefix("#") else { return nil }
    let digits = String(trimmed.dropFirst())
    guard let rgb = UInt64(digits, radix: 16) else { return nil }
    self.init(
      red: Double((rgb >> 16) & 0xFF) / 255,
      green: Double((rgb >> 8) & 0xFF) / 255,
      blue: Double(rgb & 0xFF) / 255
    )
  }
}
