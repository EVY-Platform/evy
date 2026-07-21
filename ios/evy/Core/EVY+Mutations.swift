//
//  EVY+Mutations.swift
//  evy
//

import Foundation

extension EVY {
  private struct MutationParams: Encodable {
    let service: String
    let resource: String
    let filter: Filter
    let data: EVYJson
  }

  private static func syncMutation(method: String, params: MutationParams) {
    Task {
      do {
        _ = try await EVYAPIManager.shared.fetch(
          method: method,
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

    if let json = try? store.getJsonForBinding(
      key: firstProp, cacheScopeId: activeCacheScopeId),
      json.parsePropStrict(props: remainingProps) != nil
    {
      return true
    }

    return false
  }

  static func resetEphemeralDrafts(
    forFlowId flowId: String,
    from store: EVYDataStore = EVY.publicStore
  ) {
    for pageId in EVYFlowStore.pageIds(inFlowId: flowId, from: store) {
      draftStore.deleteDrafts(scopeId: EVYDraft.ephemeralScopeId(forPageId: pageId))
    }
  }

  static func create(
    namespace: String,
    resource: String,
    data: [String: EVYJson]? = nil
  ) throws {
    if let data {
      try createWithGeneratedId(namespace: namespace, resource: resource, payload: data)
      return
    }

    let scopeForMerge = draftStore.activeScopeId
    let isFlowSubmission = EVYDraft.Scope.entityKey(fromScopeId: scopeForMerge) == resource

    var mergedPayload: EVYJson = .dictionary([:])
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

    guard case .dictionary(let payload) = mergedPayload else {
      throw EVYParamError.invalidProps
    }
    try createWithGeneratedId(namespace: namespace, resource: resource, payload: payload)

    if isFlowSubmission, let scopeForMerge {
      draftStore.deleteDrafts(scopeId: scopeForMerge)
      if let flowId = EVYDraft.Scope.flowId(fromScopeId: scopeForMerge) {
        resetEphemeralDrafts(forFlowId: flowId)
      }
    }
  }

  private static func createWithGeneratedId(
    namespace: String,
    resource: String,
    payload: [String: EVYJson]
  ) throws {
    let newId = UUID().uuidString
    var payloadWithId = payload
    payloadWithId["id"] = .string(newId)
    if payloadWithId["createdAt"] == nil {
      payloadWithId["createdAt"] = .string(EVY.nowISO8601())
    }
    let dataWithId = EVYJson.dictionary(payloadWithId)
    let params = MutationParams(
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

    syncMutation(method: "create", params: params)
  }

  static func update(
    namespace: String,
    resource: String,
    matching filter: [String: EVYJson],
    changes: [String: EVYJson]
  ) throws {
    let allRows = try publicStore.getAll(namespace: namespace, resource: resource)
    var matchedUpdates: [(rowId: String, recordId: String, updatedData: EVYJson)] = []

    for row in allRows {
      let decoded = try row.decoded()
      guard case .dictionary(let record) = decoded else { continue }
      guard case .string(let recordId) = record["id"] else { continue }
      let matches = filter.allSatisfy { key, expectedValue in
        if case .null = expectedValue {
          // null filters match records where the key is absent or JSON null
          guard let recordValue = record[key] else { return true }
          if case .null = recordValue { return true }
          return false
        }
        return record[key]?.toString() == expectedValue.toString()
      }
      guard matches else { continue }

      var updatedRecord = record
      for (key, value) in changes {
        updatedRecord[key] = value
      }
      matchedUpdates.append(
        (rowId: row.id, recordId: recordId, updatedData: .dictionary(updatedRecord)))
    }

    for update in matchedUpdates {
      let encodedData = try JSONEncoder().encode(update.updatedData)
      try publicStore.update(
        namespace: namespace,
        resource: resource,
        id: update.rowId,
        value: encodedData
      )

      let params = MutationParams(
        service: namespace,
        resource: resource,
        filter: Filter(id: update.recordId),
        data: update.updatedData
      )
      syncMutation(method: "update", params: params)
    }
  }

  static func prepareDraftData(
    value: EVYJson,
    destination: String
  ) throws -> (variableName: String, data: Data) {
    let destinationProps = _parsePropsFromText(destination)
    if let (functionName, functionArgs) = EVY.parseFunctionCall(destinationProps),
      let builtData = try dataForBuildFunction(
        functionName, functionArgs: functionArgs, value: value.toString())
    {
      return (functionArgs, builtData)
    }
    let encoded = try JSONEncoder().encode(value)
    return (destinationProps, encoded)
  }

  static func writeRawValue(
    _ value: EVYJson,
    to destination: String,
    scopeId: String? = nil
  ) throws {
    let (variableName, data) = try prepareDraftData(value: value, destination: destination)
    try updateData(data, destination: variableName, scopeId: scopeId)
  }

  /// Writes a string destination value, quoting plain text when the destination is not a build* function call.
  static func writeRawStringValue(
    _ value: String,
    to destination: String,
    scopeId: String? = nil
  ) throws {
    try updateValue(value, destination: destination, scopeId: scopeId)
  }

  static func updateValue(
    _ value: String,
    destination: String,
    scopeId: String? = nil
  ) throws {
    let destinationProps = _parsePropsFromText(destination)
    if let (functionName, functionArgs) = EVY.parseFunctionCall(destinationProps),
      let builtData = try dataForBuildFunction(
        functionName, functionArgs: functionArgs, value: value)
    {
      try updateData(builtData, destination: functionArgs, scopeId: scopeId)
      return
    }
    try updateData("\"\(value)\"".data(using: .utf8)!, destination: destination, scopeId: scopeId)
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

  static func updateData(_ newData: Data, destination: String, scopeId: String? = nil) throws {
    let variableName = _parsePropsFromText(destination)
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
      try store.persistChanges()
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
      let cachedRow = try? cacheStore.get(
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
