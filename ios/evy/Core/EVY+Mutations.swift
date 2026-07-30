//
//  EVY+Mutations.swift
//  evy
//

import Foundation

extension EVY {
  private struct MutationParams: Encodable {
    let resource: String
    let filter: Filter
    let data: EVYJson
  }

  private static func syncMutation(method: String, params: MutationParams) {
    if let syncTransport {
      syncTransport(method, params)
      return
    }
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

    if let split = EVYResourceRef.split(pathSegments: splitProps),
      let json = try? getSyncedJsonForRef(split.ref),
      json.parsePropStrict(props: split.remaining) != nil
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
    data: [String: EVYJson]? = nil,
    isSubmission: Bool = false
  ) throws -> String {
    if let data {
      if isSubmission {
        throw EVYError.invalidData(
          context: "submit create cannot include inline data")
      }
      return try createWithGeneratedId(namespace: namespace, resource: resource, payload: data)
    }

    guard isSubmission else {
      throw EVYError.invalidData(
        context:
          "create requires resource, and submit or data, e.g. create(marketplace.items,submit)"
      )
    }

    let scopeForMerge = draftStore.activeScopeId
    guard EVYDraft.Scope.isActiveCreateScope(for: resource, activeScopeId: scopeForMerge) else {
      throw EVYError.invalidData(
        context: "submit create requires an active create scope for \(resource)")
    }

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
      // Flow submission only merges entity-field drafts (`{resource.field}` → explicitPath).
      // Page-local aliases like `{pickup_address}` stay off the item — the address lives in
      // core `addresses`, linked via `transfer_options.pickup.address_id`.
      if case .aliasFlat = binding.mergeMode {
        continue
      }
      mergedPayload = EVYDraft.merge(binding: binding, value: draftValue, into: mergedPayload)
    }

    guard case .dictionary(let payload) = mergedPayload else {
      throw EVYParamError.invalidProps
    }
    let createdId = try createWithGeneratedId(
      namespace: namespace, resource: resource, payload: payload)

    if let scopeForMerge {
      draftStore.deleteDrafts(scopeId: scopeForMerge)
      if let flowId = EVYDraft.Scope.flowId(fromScopeId: scopeForMerge) {
        resetEphemeralDrafts(forFlowId: flowId)
      }
    }
    return createdId
  }

  private static func createWithGeneratedId(
    namespace: String,
    resource: String,
    payload: [String: EVYJson]
  ) throws -> String {
    let newId = UUID().uuidString.lowercased()
    var payloadWithId = payload
    payloadWithId["id"] = .string(newId)
    if payloadWithId["created_at"] == nil {
      payloadWithId["created_at"] = .string(EVY.nowISO8601(fractional: true))
    }
    if payloadWithId["visibility"] == nil,
      let declared = EVYCoreResource(ref: resource)?.visibility,
      namespace == EVYNamespace.evy
    {
      payloadWithId["visibility"] = .string(declared)
    }
    let dataWithId = EVYJson.dictionary(payloadWithId)
    let params = MutationParams(
      resource: resource,
      filter: Filter(id: newId),
      data: dataWithId
    )
    let encodedData = try JSONEncoder().encode(dataWithId)
    let targetStore = storeForSyncedRecord(dataWithId)
    let nextSortIndex = targetStore.nextSortIndex(namespace: namespace, resource: resource)
    try targetStore.create(
      namespace: namespace,
      resource: resource,
      id: newId,
      value: encodedData,
      sortIndex: nextSortIndex
    )
    recordOwnership(resource: resource, id: newId)

    syncMutation(method: "create", params: params)
    return newId
  }

  private static func applyChanges(
    _ changes: [String: EVYJson],
    to record: [String: EVYJson]
  ) throws -> [String: EVYJson]? {
    var updatedRecord = record
    var dottedChanges: [(key: String, value: EVYJson)] = []

    for (key, value) in changes {
      if !key.contains(".") {
        updatedRecord[key] = value
      } else {
        dottedChanges.append((key, value))
      }
    }

    guard !dottedChanges.isEmpty else {
      return updatedRecord
    }

    var encodedRecord = try JSONEncoder().encode(EVYJson.dictionary(updatedRecord))
    for (key, value) in dottedChanges {
      let props = key.split(separator: ".").map(String.init)
      let encodedValue = try JSONEncoder().encode(value)
      encodedRecord = try EVYDataPatcher.patch(
        encodedData: encodedRecord, newData: encodedValue, props: props)
    }
    guard
      case .dictionary(let patchedRecord) = try JSONDecoder().decode(
        EVYJson.self, from: encodedRecord)
    else {
      return nil
    }
    return patchedRecord
  }

  static func update(
    namespace: String,
    resource: String,
    matching filter: [String: EVYJson],
    changes: [String: EVYJson]
  ) throws {
    var allRows: [(row: EVYData, store: EVYDataStore)] = []
    for store in syncedStores() {
      let rows = (try? store.getAll(namespace: namespace, resource: resource)) ?? []
      allRows.append(contentsOf: rows.map { ($0, store) })
    }
    var matchedUpdates:
      [(rowId: String, recordId: String, updatedData: EVYJson, store: EVYDataStore)] =
        []

    for (row, rowStore) in allRows {
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
      guard let patched = try applyChanges(changes, to: updatedRecord) else {
        continue
      }
      updatedRecord = patched
      matchedUpdates.append(
        (
          rowId: row.id, recordId: recordId, updatedData: .dictionary(updatedRecord),
          store: rowStore
        ))
    }

    let cacheRowsForScope: [EVYData] =
      if let scopeId = activeCacheScopeId {
        (try? cacheStore.getAll(namespace: EVYNamespace.cache, resource: scopeId)) ?? []
      } else {
        []
      }

    let decodedCacheRows: [(row: EVYData, recordId: String)] = cacheRowsForScope.compactMap {
      cacheRow in
      guard case .dictionary(let cachedRecord) = try? cacheRow.decoded(),
        case .string(let cachedId) = cachedRecord["id"]
      else { return nil }
      return (cacheRow, cachedId)
    }

    for update in matchedUpdates {
      let encodedData = try JSONEncoder().encode(update.updatedData)
      try update.store.update(
        namespace: namespace,
        resource: resource,
        id: update.rowId,
        value: encodedData
      )

      if let scopeId = activeCacheScopeId, !decodedCacheRows.isEmpty {
        for (cacheRow, cachedId) in decodedCacheRows where cachedId == update.recordId {
          try cacheStore.update(
            namespace: EVYNamespace.cache,
            resource: scopeId,
            id: cacheRow.id,
            value: encodedData
          )
          cacheStore.postValueChanged(key: cacheRow.id)
        }
      }

      let params = MutationParams(
        resource: resource,
        filter: Filter(id: update.recordId),
        data: update.updatedData
      )
      syncMutation(method: "update", params: params)
    }
  }

  static func mergeIntoActiveDraft(resource: String, changes: [String: EVYJson]) throws {
    guard
      EVYDraft.Scope.isActiveCreateScope(
        for: resource,
        activeScopeId: draftStore.activeScopeId
      )
    else {
      throw EVYError.invalidData(
        context: "draft-mode update requires an active create scope for \(resource)")
    }
    for (key, value) in changes {
      try writeRawValue(value, to: "{\(resource).\(key)}")
    }
  }

  /// Resolves an object-template destination (`{path: {…$datum…}}`) into the
  /// path it writes to and the encoded record to write. Returns nil when the
  /// destination is a plain path rather than a template.
  private static func resolveObjectTemplateDestination(
    destinationProps: String,
    datum: EVYJson
  ) throws -> (path: String, data: Data)? {
    guard let (path, template) = try EVYObjectLiteral.parseDestination(from: destinationProps)
    else {
      return nil
    }
    let resolved = EVYPlainTextResolution.resolveValues(template, datum: datum)
    return (path, try JSONEncoder().encode(EVYJson.dictionary(resolved)))
  }

  static func prepareDraftData(
    value: EVYJson,
    destination: String
  ) throws -> (variableName: String, data: Data) {
    let destinationProps = _parsePropsFromText(destination)
    // A plain string is re-parsed so numeric text lands in the record as a number.
    let datum: EVYJson
    if case .string(let stringValue) = value {
      datum = evyJsonValue(from: stringValue)
    } else {
      datum = value
    }
    if let (path, data) = try resolveObjectTemplateDestination(
      destinationProps: destinationProps,
      datum: datum
    ) {
      return (path, data)
    }
    return (destinationProps, try JSONEncoder().encode(value))
  }

  static func writeRawValue(
    _ value: EVYJson,
    to destination: String,
    scopeId: String? = nil
  ) throws {
    let (variableName, data) = try prepareDraftData(value: value, destination: destination)
    try updateData(data, destination: variableName, scopeId: scopeId)
  }

  /// Writes a string destination value, quoting plain text when the destination is not an object template.
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
    if let (path, data) = try resolveObjectTemplateDestination(
      destinationProps: destinationProps,
      datum: evyJsonValue(from: value)
    ) {
      try updateData(data, destination: "{\(path)}", scopeId: scopeId)
      return
    }
    try updateData("\"\(value)\"".data(using: .utf8)!, destination: destination, scopeId: scopeId)
  }

  static func updateData(_ newData: Data, destination: String, scopeId: String? = nil) throws {
    let variableName = _parsePropsFromText(destination)
    let (_, cleanVariableName) = store(for: variableName)
    let splitProps = try splitPropsFromText(cleanVariableName)
    let rootVariable = EVYResourceRef.split(pathSegments: splitProps)?.ref ?? splitProps.first!
    let resolvedScopeId = scopeId ?? draftStore.activeScopeId

    if let resolvedScopeId,
      let match = try draftStore.draftMatch(splitProps: splitProps, scopeId: resolvedScopeId)
    {
      if match.remainingProps.isEmpty {
        match.draft.data = newData
      } else {
        match.draft.data = try EVYDataPatcher.patch(
          encodedData: match.draft.data, newData: newData, props: match.remainingProps)
      }
      draftStore.notifyUpdate(binding: match.binding)
      return
    }

    // Create-merge scopes must not fall through to findRowForUpdate for the entity declared
    // via the flow's submit create: findRowForUpdate returns the first existing row of the
    // resource, so nested writes would patch a seeded listing instead of the create draft.
    let writesIntoCreateEntity = EVYDraft.Scope.isActiveCreateScope(
      for: rootVariable,
      activeScopeId: resolvedScopeId
    )

    if !writesIntoCreateEntity,
      let existingRow = try? findRowForUpdate(rootVariable: rootVariable)
    {
      let remainingProps = Array(splitProps.dropFirst())
      if remainingProps.isEmpty {
        existingRow.row.data = newData
      } else {
        existingRow.row.data = try EVYDataPatcher.patch(
          encodedData: existingRow.row.data, newData: newData, props: remainingProps)
      }
      try existingRow.store.persistChanges()
      existingRow.store.postValueChanged(key: splitProps.joined(separator: PROP_SEPARATOR))
      return
    }

    guard let resolvedScopeId else {
      throw EVYDataError.keyNotFound
    }
    let draftBinding = try draftStore.binding(
      fromParsedProps: cleanVariableName, scopeId: resolvedScopeId)
    try cacheStore.create(
      namespace: EVYNamespace.draft,
      resource: draftBinding.scopeId,
      id: draftBinding.draftKey,
      value: newData
    )
    draftStore.notifyUpdate(binding: draftBinding)
  }

  private static func findRowForUpdate(rootVariable: String) throws -> (
    row: EVYData, store: EVYDataStore
  ) {
    for store in syncedStores() {
      if let localRow = try? store.get(
        namespace: EVYNamespace.local, resource: rootVariable, id: EVYNamespace.singletonId)
      {
        return (localRow, store)
      }
    }
    if let scopeId = activeCacheScopeId,
      let cachedRow = try? cacheStore.get(
        namespace: EVYNamespace.cache, resource: scopeId, id: rootVariable)
    {
      return (cachedRow, publicStore)
    }
    if let namespace = try? EVYResourceRef.serviceOf(rootVariable) {
      for store in syncedStores() {
        let rows = (try? store.getAll(namespace: namespace, resource: rootVariable)) ?? []
        if let matched = rows.first {
          return (matched, store)
        }
      }
    }
    throw EVYDataError.keyNotFound
  }

}
