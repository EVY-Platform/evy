//
//  EVY+Mutations.swift
//  evy
//

import Foundation

extension EVY {
  static func ensureDraftExists(
    variableName: String,
    initialData: Data? = nil,
    scopeId: String? = nil
  ) {
    let (store, cleanVariableName) = store(for: variableName)
    guard let resolvedScopeId = scopeId ?? draftStore.activeScopeId,
      let binding = try? draftStore.binding(
        fromParsedProps: cleanVariableName,
        scopeId: resolvedScopeId
      )
    else {
      return
    }
    guard (try? store.getJsonForBinding(key: cleanVariableName)) == nil,
      draftStore.draftIfPresent(binding: binding) == nil
    else {
      return
    }
    let emptyData = initialData ?? "\"\"".data(using: .utf8)!
    do {
      try cacheStore.create(
        namespace: EVYNamespace.draft,
        resource: binding.scopeId,
        id: binding.draftKey,
        value: emptyData
      )
      draftStore.notifyUpdate(binding: binding)
    } catch {
      // Best-effort draft bootstrap; callers can still render from existing data.
    }
  }

  static func create(namespace: String, resource: String, draftScopeId: String? = nil) throws {
    struct CreateParams: Encodable {
      let service: String
      let resource: String
      let filter: Filter?
      let data: EVYJson
    }

    let newId = UUID().uuidString

    var mergedPayload: EVYJson = .dictionary([:])

    let scopeForMerge = draftScopeId ?? draftStore.activeScopeId
    let draftEntries = scopeForMerge.flatMap { try? draftStore.drafts(forScopeId: $0) } ?? []
    for draftEntry in draftEntries {
      let draftValue = try draftEntry.decoded()
      if case .string(let s) = draftValue, s.isEmpty {
        continue
      }
      guard let binding = EVYDraft.Binding.parseDraftKey(draftEntry.id) else {
        continue
      }
      mergedPayload = EVYDraft.merge(binding: binding, value: draftValue, into: mergedPayload)
    }

    guard case .dictionary(var dict) = mergedPayload else {
      throw EVYParamError.invalidProps
    }
    dict["id"] = .string(newId)
    let dataWithId = EVYJson.dictionary(dict)
    let params = CreateParams(
      service: namespace,
      resource: resource,
      filter: Filter(id: newId),
      data: dataWithId
    )
    let encodedData = try JSONEncoder().encode(dataWithId)
    let nextSortIndex = publicStore.nextSortIndex(namespace: namespace, resource: resource)
    try publicStore.create(
      namespace: namespace,
      resource: resource,
      id: newId,
      value: encodedData,
      sortIndex: nextSortIndex
    )

    Task {
      do {
        _ = try await EVYAPIManager.shared.fetch(
          method: "create",
          params: params,
          expecting: EVYJson.self
        )
      } catch {
        NotificationCenter.default.post(
          name: .evyErrorOccurred,
          object: error
        )
      }
    }
  }

  static func updateValue(_ value: String, at: String, scopeId: String? = nil) throws {
    let destinationProps = _parsePropsFromText(at)
    if let (functionName, functionArgs) = parseFunctionCall(destinationProps) {
      switch functionName {
      case "buildCurrency":
        try updateData(
          try evyBuildCurrency(functionArgs, value), at: functionArgs, scopeId: scopeId)
        return
      case "buildAddress":
        try updateData(try evyBuildAddress(functionArgs, value), at: functionArgs, scopeId: scopeId)
        return
      default:
        break
      }
    }
    try updateData("\"\(value)\"".data(using: .utf8)!, at: at, scopeId: scopeId)
  }

  static func updateData(_ newData: Data, at: String, scopeId: String? = nil) throws {
    let variableName = _parsePropsFromText(at)
    let (store, cleanVariableName) = store(for: variableName)
    let splitProps = try splitPropsFromText(cleanVariableName)
    let rootVariable = splitProps.first!
    let resolvedScopeId = scopeId ?? draftStore.activeScopeId
    let draftBinding = try resolvedScopeId.map {
      try draftStore.binding(fromParsedProps: cleanVariableName, scopeId: $0)
    }

    if let draftBinding,
      let existingDraft = draftStore.draftIfPresent(binding: draftBinding)
    {
      let remainingProps = EVYDraft.remainingPropsAfterDraftPrefix(
        splitProps: splitProps,
        binding: draftBinding
      )
      if remainingProps.isEmpty {
        existingDraft.data = newData
      } else {
        existingDraft.data = try EVYDataPatcher.patch(
          encodedData: existingDraft.data, newData: newData, props: remainingProps)
      }
      draftStore.notifyUpdate(binding: draftBinding)
    } else if let existingRow = try? findRowForUpdate(store: store, rootVariable: rootVariable) {
      let remainingProps = Array(splitProps.dropFirst())
      if remainingProps.isEmpty {
        existingRow.data = newData
      } else {
        existingRow.data = try EVYDataPatcher.patch(
          encodedData: existingRow.data, newData: newData, props: remainingProps)
      }
      store.postDataChanged(key: splitProps.joined(separator: PROP_SEPARATOR))
    } else {
      guard let draftBinding else {
        throw EVYDataError.keyNotFound
      }
      try cacheStore.create(
        namespace: EVYNamespace.draft,
        resource: draftBinding.scopeId,
        id: draftBinding.draftKey,
        value: newData
      )
      draftStore.notifyUpdate(binding: draftBinding)
    }
  }

  private static func findRowForUpdate(store: EVYDataStore, rootVariable: String) throws -> EVYData
  {
    if let localRow = try? store.get(
      namespace: EVYNamespace.local, resource: rootVariable, id: EVYNamespace.singletonId)
    {
      return localRow
    }
    if let scopeId = activeCacheScopeId,
      let cachedRow = try? store.get(
        namespace: EVYNamespace.cache, resource: scopeId, id: rootVariable)
    {
      return cachedRow
    }
    let allRows = (try? store.getAll()) ?? []
    guard let matched = allRows.first(where: { $0.resource == rootVariable }) else {
      throw EVYDataError.keyNotFound
    }
    return matched
  }

}
