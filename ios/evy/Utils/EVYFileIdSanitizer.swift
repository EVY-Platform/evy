//
//  EVYFileIdSanitizer.swift
//  evy
//

import Foundation

enum EVYFileIdSanitizer {
  static func sanitizedFileId(_ raw: String) -> String? {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, !trimmed.hasPrefix("{"), !trimmed.hasPrefix("[") else {
      return nil
    }
    return trimmed
  }

  static func sanitizedFileId(from value: EVYJson) -> String? {
    guard case .string(let id) = value else { return nil }
    return sanitizedFileId(id)
  }
}
