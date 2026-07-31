//
//  EVYActionInvocation.swift
//  evy
//

import Foundation

/// Parsed action call used by the runner at execution time.
///
/// Decoded from an inline `{fn(…)}` expression string. Map-value expressions
/// stay as strings; braced-only value-position resolution happens when the
/// action runs.
public enum EVYActionInvocation: Equatable {
  case close
  case selectPhoto
  case expandPhoto
  case deletePhoto
  case show(rowId: String)
  case expandText(rowId: String)
  case highlightRequired(field: String)
  case select(value: String)
  case copyToClipboard(value: String)
  case navigate(flowId: String, pageId: String, query: [String: String])
  case create(
    resource: String,
    mode: CreateMode,
    id_destination: String?)
  case update(
    resource: String,
    mode: UpdateMode,
    filter: [String: String],
    changes: EVYObjectArgument)

  public enum CreateMode: Equatable {
    case submit
    case inline(data: [String: String])
    case fromPath(data_path: String)
  }

  public enum UpdateMode: Equatable {
    case store
    case draft
  }
}

/// An action branch: either nothing to do, or a parsed invocation.
public enum EVYActionBranch: Equatable {
  case empty
  case invocation(EVYActionInvocation)
}

// MARK: - Codable

extension EVYActionBranch: Codable {
  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    let text = try container.decode(String.self)
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      self = .empty
      return
    }
    self = .invocation(try EVYActionParser.parse(text))
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .empty:
      try container.encode("")
    case .invocation(let invocation):
      try container.encode(EVYActionParser.serialize(invocation))
    }
  }
}

extension EVYActionInvocation.UpdateMode: RawRepresentable {
  public init?(rawValue: String) {
    switch rawValue {
    case "store": self = .store
    case "draft": self = .draft
    default: return nil
    }
  }

  public var rawValue: String {
    switch self {
    case .store: return "store"
    case .draft: return "draft"
    }
  }
}
