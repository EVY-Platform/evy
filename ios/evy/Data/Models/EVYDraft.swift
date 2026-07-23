//
//  EVYDraft.swift
//  evy
//

import Foundation

enum EVYDraft {
  enum MergeMode: Equatable {
    case explicitPath(pathSegments: [String])
    case aliasFlat(pathSegments: [String])
  }

  struct Binding: Equatable {
    let scopeId: String
    let pathSegments: [String]
    let mergeMode: MergeMode

    var pathKey: String {
      (try? JSONSerialization.data(withJSONObject: pathSegments))?
        .base64EncodedString() ?? pathSegments.joined(separator: "\u{1f}")
    }

    // Internal cache key format: <scopeId>:<modeFlag><base64PathKey>.
    // The mode flag is "a" for alias-flat bindings and "e" for explicit paths.
    var draftKey: String {
      let modeFlag: String
      switch mergeMode {
      case .aliasFlat:
        modeFlag = "a"
      case .explicitPath:
        modeFlag = "e"
      }

      return "\(scopeId):\(modeFlag)\(pathKey)"
    }

    var notificationKey: String {
      pathSegments.joined(separator: PROP_SEPARATOR)
    }

    static func draftKeyPrefix(forScopeId scopeId: String) -> String {
      "\(scopeId):"
    }

    // Scope IDs can contain colons, so split on the last colon to separate
    // the scope from the mode/path portion of the draft cache key.
    static func parseDraftKey(_ key: String) -> Binding? {
      guard let separatorRange = key.range(of: ":", options: .backwards) else {
        return nil
      }

      let scopeId = String(key[..<separatorRange.lowerBound])
      let modeAndPathKey = String(key[separatorRange.upperBound...])
      guard let modeFlag = modeAndPathKey.first else {
        return nil
      }

      let pathKey = String(modeAndPathKey.dropFirst())
      guard
        let rawPathData = Data(base64Encoded: pathKey),
        let pathSegments = try? JSONSerialization.jsonObject(with: rawPathData) as? [String]
      else {
        return nil
      }

      let mergeMode: MergeMode
      switch modeFlag {
      case "a":
        mergeMode = .aliasFlat(pathSegments: pathSegments)
      case "e":
        mergeMode = .explicitPath(pathSegments: pathSegments)
      default:
        return nil
      }

      return Binding(
        scopeId: scopeId,
        pathSegments: pathSegments,
        mergeMode: mergeMode
      )
    }
  }

  enum Scope {
    static let fallbackUnscoped = "app:unscoped"
    private static let browseKey = "browse"

    private static func splitScopeId(_ scopeId: String?) -> (flowId: String, key: String)? {
      guard let scopeId else { return nil }

      let trimmedScopeId = scopeId.trimmingCharacters(in: .whitespacesAndNewlines)
      if trimmedScopeId == fallbackUnscoped || trimmedScopeId.hasPrefix("ephemeral:") {
        return nil
      }

      guard let range = trimmedScopeId.range(of: ":", options: .backwards) else { return nil }

      let flowId = String(trimmedScopeId[..<range.lowerBound])
      let key = String(trimmedScopeId[range.upperBound...])
      if flowId.isEmpty || key.isEmpty || key == Self.browseKey { return nil }
      return (flowId, key)
    }

    static func entityKey(fromScopeId scopeId: String?) -> String? {
      splitScopeId(scopeId)?.key
    }

    static func flowId(fromScopeId scopeId: String?) -> String? {
      splitScopeId(scopeId)?.flowId
    }
  }

  @MainActor
  static func binding(parsedProps: String, scopeId: String?) throws -> Binding {
    let segments = try splitPropsFromText(parsedProps)

    if let first = segments.first, UUID(uuidString: first) != nil, segments.count == 1 {
      let ephemeralScope = "ephemeral:\(first)"
      return Binding(
        scopeId: ephemeralScope,
        pathSegments: [first],
        mergeMode: .aliasFlat(pathSegments: [first])
      )
    }

    let effectiveScope = scopeId ?? Scope.fallbackUnscoped
    let entityKey = Scope.entityKey(fromScopeId: effectiveScope)

    if let ek = entityKey,
      segments.first == ek,
      segments.count > 1
    {
      let rest = Array(segments.dropFirst())
      return Binding(
        scopeId: effectiveScope,
        pathSegments: rest,
        mergeMode: .explicitPath(pathSegments: rest)
      )
    }

    // Page-local aliases on an entity create/edit scope (e.g. `{pickup_address}`) stay in
    // the same scope for reads, but use aliasFlat so create() can omit them from the
    // submitted entity — only `{entityKey.*}` paths become item fields.
    if let ek = entityKey, segments.first != ek {
      return Binding(
        scopeId: effectiveScope,
        pathSegments: segments,
        mergeMode: .aliasFlat(pathSegments: segments)
      )
    }

    if segments.count > 1 {
      return Binding(
        scopeId: effectiveScope,
        pathSegments: segments,
        mergeMode: .explicitPath(pathSegments: segments)
      )
    }

    return Binding(
      scopeId: effectiveScope,
      pathSegments: segments,
      mergeMode: .aliasFlat(pathSegments: segments)
    )
  }

  static func createMergeScopeId(flowId: String, entityKey: String) -> String {
    "\(flowId):\(entityKey)"
  }

  static func ephemeralScopeId(forPageId pageId: String) -> String {
    "ephemeral:\(pageId)"
  }

  static func merge(binding: Binding, value draftValue: EVYJson, into entity: EVYJson) -> EVYJson {
    switch binding.mergeMode {
    case .explicitPath(let path):
      return evyJsonUpdating(json: entity, at: path, with: draftValue) ?? entity
    case .aliasFlat(let pathSegments):
      let leafName = pathSegments.last ?? ""
      return mergeDraftValue(
        variableName: leafName,
        draftValue: draftValue,
        into: entity
      )
    }
  }

  static func remainingPropsAfterDraftPrefix(splitProps: [String], binding: Binding) -> [String] {
    let path = binding.pathSegments
    if splitProps.count >= path.count, Array(splitProps.prefix(path.count)) == path {
      return Array(splitProps.suffix(splitProps.count - path.count))
    }
    if let ek = Scope.entityKey(fromScopeId: binding.scopeId),
      splitProps.first == ek,
      splitProps.count > 1,
      Array(splitProps.dropFirst()) == path
    {
      return []
    }
    return splitProps
  }
}

private func mergeDraftValue(
  variableName: String,
  draftValue: EVYJson,
  into entity: EVYJson
) -> EVYJson {
  guard case .dictionary(var dict) = entity else {
    return entity
  }

  if dict[variableName] != nil {
    dict[variableName] = draftValue
    return .dictionary(dict)
  }

  let matchingPaths = leafPaths(named: variableName, in: entity)
  if matchingPaths.count == 1,
    let updated = evyJsonUpdating(json: entity, at: matchingPaths[0], with: draftValue)
  {
    return updated
  }

  dict[variableName] = draftValue
  return .dictionary(dict)
}

private func leafPaths(
  named variableName: String,
  in json: EVYJson,
  currentPath: [String] = []
) -> [[String]] {
  switch json {
  case .dictionary(let dict):
    return dict.flatMap { key, value in
      let path = currentPath + [key]
      let directMatch = key == variableName ? [path] : []
      return directMatch + leafPaths(named: variableName, in: value, currentPath: path)
    }
  case .array(let array):
    return array.enumerated().flatMap { index, value in
      leafPaths(
        named: variableName,
        in: value,
        currentPath: currentPath + [String(index)]
      )
    }
  default:
    return []
  }
}

private func evyJsonUpdating(
  json: EVYJson,
  at path: [String],
  with value: EVYJson
) -> EVYJson? {
  guard let head = path.first else {
    return value
  }

  switch json {
  case .dictionary(var dict):
    if path.count == 1 {
      dict[head] = value
      return .dictionary(dict)
    }
    let child = dict[head] ?? .dictionary([:])
    guard
      let updatedChild = evyJsonUpdating(
        json: child,
        at: Array(path.dropFirst()),
        with: value
      )
    else {
      return nil
    }
    dict[head] = updatedChild
    return .dictionary(dict)
  case .array(var array):
    guard let index = Int(head), array.indices.contains(index) else {
      return nil
    }
    if path.count == 1 {
      array[index] = value
      return .array(array)
    }
    guard
      let updatedChild = evyJsonUpdating(
        json: array[index],
        at: Array(path.dropFirst()),
        with: value
      )
    else {
      return nil
    }
    array[index] = updatedChild
    return .array(array)
  default:
    return nil
  }
}
