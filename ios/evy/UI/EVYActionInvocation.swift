//
//  EVYActionInvocation.swift
//  evy
//

import Foundation

/// Structured form of an action call, mirroring `UI_ActionInvocation` in
/// types/schema/sdui/action.schema.json.
///
/// Value expressions stay as strings: whether a bare word is a data path or a
/// literal is decided at execution time against live data, so the AST records
/// what was written rather than committing to an interpretation.
public enum EVYActionInvocation: Equatable {
  case close
  case selectPhoto
  case expandPhoto
  case deletePhoto
  case show(rowId: String)
  case expandText(rowId: String)
  case highlightRequired(field: String)
  case select(value: String)
  case navigate(flowId: String, pageId: String, query: [String: String])
  case create(
    service: String,
    resource: String,
    mode: CreateMode,
    id_destination: String?)
  case update(
    service: String,
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

/// An action branch: either nothing to do, or a structured invocation.
public enum EVYActionBranch: Equatable {
  case empty
  case invocation(EVYActionInvocation)
}

// MARK: - Codable

extension EVYActionBranch: Codable {
  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let text = try? container.decode(String.self) {
      guard text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw DecodingError.dataCorruptedError(
          in: container,
          debugDescription:
            "Action branches are structured invocations; only the empty string means do nothing"
        )
      }
      self = .empty
      return
    }
    self = .invocation(try container.decode(EVYActionInvocation.self))
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .empty: try container.encode("")
    case .invocation(let invocation): try container.encode(invocation)
    }
  }
}

extension EVYActionInvocation: Codable {
  private enum CodingKeys: String, CodingKey {
    case fn, rowId, field, value, flowId, pageId, query
    case service, resource, mode, data, data_path, id_destination
    case filter, changes, changes_path
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let fn = try container.decode(String.self, forKey: .fn)

    switch fn {
    case "close": self = .close
    case "select_photo": self = .selectPhoto
    case "expand_photo": self = .expandPhoto
    case "delete_photo": self = .deletePhoto
    case "show":
      self = .show(rowId: try container.decode(String.self, forKey: .rowId))
    case "expand_text":
      self = .expandText(rowId: try container.decode(String.self, forKey: .rowId))
    case "highlight_required":
      self = .highlightRequired(field: try container.decode(String.self, forKey: .field))
    case "select":
      self = .select(value: try container.decode(String.self, forKey: .value))
    case "navigate":
      self = .navigate(
        flowId: try container.decode(String.self, forKey: .flowId),
        pageId: try container.decode(String.self, forKey: .pageId),
        query: try container.decodeIfPresent([String: String].self, forKey: .query) ?? [:]
      )
    case "create":
      self = .create(
        service: try container.decode(String.self, forKey: .service),
        resource: try container.decode(String.self, forKey: .resource),
        mode: try Self.decodeCreateMode(from: container),
        id_destination: try container.decodeIfPresent(String.self, forKey: .id_destination)
      )
    case "update":
      let rawMode = try container.decode(String.self, forKey: .mode)
      guard let mode = UpdateMode(rawValue: rawMode) else {
        throw Self.unsupported("update mode \(rawMode)", container)
      }
      self = .update(
        service: try container.decode(String.self, forKey: .service),
        resource: try container.decode(String.self, forKey: .resource),
        mode: mode,
        filter: try container.decodeIfPresent([String: String].self, forKey: .filter) ?? [:],
        changes: try Self.decodeChanges(from: container)
      )
    default:
      throw Self.unsupported("action function \(fn)", container)
    }
  }

  private static func decodeCreateMode(
    from container: KeyedDecodingContainer<CodingKeys>
  ) throws -> CreateMode {
    let rawMode = try container.decode(String.self, forKey: .mode)
    switch rawMode {
    case "submit": return .submit
    case "inline":
      return .inline(data: try container.decode([String: String].self, forKey: .data))
    case "from_path":
      return .fromPath(data_path: try container.decode(String.self, forKey: .data_path))
    default:
      throw unsupported("create mode \(rawMode)", container)
    }
  }

  private static func decodeChanges(
    from container: KeyedDecodingContainer<CodingKeys>
  ) throws -> EVYObjectArgument {
    if let changes = try container.decodeIfPresent([String: String].self, forKey: .changes) {
      return .literal(changes)
    }
    return .path(try container.decode(String.self, forKey: .changes_path))
  }

  private static func unsupported(
    _ what: String,
    _ container: KeyedDecodingContainer<CodingKeys>
  ) -> DecodingError {
    DecodingError.dataCorruptedError(
      forKey: .fn, in: container, debugDescription: "Unsupported \(what)")
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case .close: try container.encode("close", forKey: .fn)
    case .selectPhoto: try container.encode("select_photo", forKey: .fn)
    case .expandPhoto: try container.encode("expand_photo", forKey: .fn)
    case .deletePhoto: try container.encode("delete_photo", forKey: .fn)
    case .show(let rowId):
      try container.encode("show", forKey: .fn)
      try container.encode(rowId, forKey: .rowId)
    case .expandText(let rowId):
      try container.encode("expand_text", forKey: .fn)
      try container.encode(rowId, forKey: .rowId)
    case .highlightRequired(let field):
      try container.encode("highlight_required", forKey: .fn)
      try container.encode(field, forKey: .field)
    case .select(let value):
      try container.encode("select", forKey: .fn)
      try container.encode(value, forKey: .value)
    case .navigate(let flowId, let pageId, let query):
      try container.encode("navigate", forKey: .fn)
      try container.encode(flowId, forKey: .flowId)
      try container.encode(pageId, forKey: .pageId)
      if !query.isEmpty { try container.encode(query, forKey: .query) }
    case .create(let service, let resource, let mode, let id_destination):
      try container.encode("create", forKey: .fn)
      try container.encode(service, forKey: .service)
      try container.encode(resource, forKey: .resource)
      switch mode {
      case .submit:
        try container.encode("submit", forKey: .mode)
      case .inline(let data):
        try container.encode("inline", forKey: .mode)
        try container.encode(data, forKey: .data)
      case .fromPath(let data_path):
        try container.encode("from_path", forKey: .mode)
        try container.encode(data_path, forKey: .data_path)
      }
      try container.encodeIfPresent(id_destination, forKey: .id_destination)
    case .update(let service, let resource, let mode, let filter, let changes):
      try container.encode("update", forKey: .fn)
      try container.encode(service, forKey: .service)
      try container.encode(resource, forKey: .resource)
      try container.encode(mode.rawValue, forKey: .mode)
      if mode == .store { try container.encode(filter, forKey: .filter) }
      switch changes {
      case .literal(let map): try container.encode(map, forKey: .changes)
      case .path(let path): try container.encode(path, forKey: .changes_path)
      }
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
