//
//  EVYError.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation

public enum EVYError: LocalizedError {
  case parsingFailed(context: String)
  case invalidData(context: String)
  case regexCompilationFailed(pattern: String)
  case imageLoadFailed(name: String)
  case formatFailed(type: String, reason: String)
  case websocketError(context: String)

  public var errorDescription: String? {
    switch self {
    case .parsingFailed(let context):
      return "Parsing failed: \(context)"
    case .invalidData(let context):
      return "Invalid data: \(context)"
    case .regexCompilationFailed(let pattern):
      return "Invalid regex pattern: \(pattern)"
    case .imageLoadFailed(let name):
      return "Failed to load image: \(name)"
    case .formatFailed(let type, let reason):
      return "Failed to format \(type): \(reason)"
    case .websocketError(let context):
      return "WebSocket error: \(context)"
    }
  }
}
