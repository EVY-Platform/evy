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
    guard !destinationHasExistingValue(store: store, cleanVariableName: cleanVariableName),
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

  /// Whether the destination already resolves to concrete instance data (query-param
  /// entities in the cache scope, local singletons, or a synced record) at its full nested
  /// path. When it does, bootstrapping an empty draft would shadow that real data, so we
  /// skip it. Synced collections that cannot descend into the requested path (e.g. the
  /// create-flow `[resource].title` alias, where `[resource]` is the whole items list) are
  /// intentionally treated as "no value" so create flows still seed an empty draft.
  private static func destinationHasExistingValue(
    store: EVYDataStore,
    cleanVariableName: String
  ) -> Bool {
    guard let splitProps = try? splitPropsFromText(cleanVariableName),
      let firstProp = splitProps.first
    else {
      return false
    }
    let remainingProps = splitProps.count > 1 ? Array(splitProps.dropFirst()) : []

    if let scopeId = activeCacheScopeId,
      let cachedRow = try? cacheStore.get(
        namespace: EVYNamespace.cache, resource: scopeId, id: firstProp),
      let decoded = try? cachedRow.decoded(),
      decoded.parsePropStrict(props: remainingProps) != nil
    {
      return true
    }

    if let json = try? store.getJsonForBinding(key: firstProp),
      json.parsePropStrict(props: remainingProps) != nil
    {
      return true
    }

    return false
  }

  static func resetEphemeralDrafts(forFlowId flowId: String) {
    for pageId in EVYFlowStore.pageIds(inFlowId: flowId) {
      draftStore.deleteDrafts(scopeId: EVYDraft.ephemeralScopeId(forPageId: pageId))
    }
  }

  static func resetEphemeralDrafts(forFlowId flowId: String, from store: EVYDataStore) {
    for pageId in EVYFlowStore.pageIds(inFlowId: flowId, from: store) {
      draftStore.deleteDrafts(scopeId: EVYDraft.ephemeralScopeId(forPageId: pageId))
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

  static func writeRawValue(
    _ value: EVYJson,
    to destination: String,
    scopeId: String? = nil
  ) throws {
    let destinationProps = _parsePropsFromText(destination)
    if let (functionName, functionArgs) = parseFunctionCall(destinationProps),
      let builtData = try dataForBuildFunction(
        functionName, functionArgs: functionArgs, value: value.toString())
    {
      try updateData(builtData, at: functionArgs, scopeId: scopeId)
      return
    }
    let encoded = try JSONEncoder().encode(value)
    try updateData(encoded, at: destination, scopeId: scopeId)
  }

  static func writeRawValue(
    _ value: String,
    to destination: String,
    scopeId: String? = nil
  ) throws {
    try updateValue(value, at: destination, scopeId: scopeId)
  }

  static func updateValue(_ value: String, at: String, scopeId: String? = nil) throws {
    let destinationProps = _parsePropsFromText(at)
    if let (functionName, functionArgs) = parseFunctionCall(destinationProps),
      let builtData = try dataForBuildFunction(
        functionName, functionArgs: functionArgs, value: value)
    {
      try updateData(builtData, at: functionArgs, scopeId: scopeId)
      return
    }
    try updateData("\"\(value)\"".data(using: .utf8)!, at: at, scopeId: scopeId)
  }

  private static func dataForBuildFunction(
    _ functionName: String,
    functionArgs: String,
    value: String
  ) throws -> Data? {
    switch functionName {
    case "buildCurrency":
      return try evyBuildCurrency(functionArgs, value)
    case "buildAddress":
      return try evyBuildAddress(functionArgs, value)
    default:
      return nil
    }
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
      store.postValueChanged(key: splitProps.joined(separator: PROP_SEPARATOR))
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
