//
//  EVYDraft.swift
//  evy
//

import Foundation
import SwiftData

@Model
final class EVYDraft {
    var scopeId: String
    var pathKey: String
    var isAliasBinding: Bool
    var data: Data

    init(scopeId: String, pathKey: String, isAliasBinding: Bool, data: Data) {
        self.scopeId = scopeId
        self.pathKey = pathKey
        self.isAliasBinding = isAliasBinding
        self.data = data
    }

    convenience init(binding: EVYDraft.Binding, data: Data) {
        let alias: Bool
        if case .aliasFlat = binding.mergeMode {
            alias = true
        } else {
            alias = false
        }
        self.init(
            scopeId: binding.scopeId,
            pathKey: binding.pathKey,
            isAliasBinding: alias,
            data: data
        )
    }

    func decoded() throws -> EVYJson {
        try JSONDecoder().decode(EVYJson.self, from: data)
    }

    func mergeModeEnum() -> EVYDraft.MergeMode {
        let segments: [String]
        if let raw = Data(base64Encoded: pathKey),
           let arr = try? JSONSerialization.jsonObject(with: raw) as? [String]
        {
            segments = arr
        } else {
            segments = []
        }
        if isAliasBinding {
            return .aliasFlat(pathSegments: segments)
        }
        return .explicitPath(pathSegments: segments)
    }

    func merged(into entity: EVYJson, draftValue: EVYJson) -> EVYJson {
        switch mergeModeEnum() {
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
}

extension EVYDraft {
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

        var notificationKey: String {
            pathSegments.joined(separator: PROP_SEPARATOR)
        }
    }

    enum Scope {
        static let fallbackUnscoped = "app#unscoped"

        static func entityKey(fromScopeId scopeId: String?) -> String? {
            guard let scopeId, let range = scopeId.range(of: "#", options: .backwards) else { return nil }
            let key = String(scopeId[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if key.isEmpty || key == "browse" { return nil }
            return key
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
        "\(flowId)#\(entityKey)"
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
        guard let child = dict[head] else {
            return nil
        }
        if path.count == 1 {
            dict[head] = value
            return .dictionary(dict)
        }
        guard let updatedChild = evyJsonUpdating(
            json: child,
            at: Array(path.dropFirst()),
            with: value
        ) else {
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
        guard let updatedChild = evyJsonUpdating(
            json: array[index],
            at: Array(path.dropFirst()),
            with: value
        ) else {
            return nil
        }
        array[index] = updatedChild
        return .array(array)
    default:
        return nil
    }
}
