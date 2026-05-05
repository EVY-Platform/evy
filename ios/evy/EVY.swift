//
//  EVY.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/6/2024.
//

import Foundation
import SwiftUI

enum EVYParamError: Error {
  case invalidProps
}

struct GetParams: Encodable {
  let service: String
  let resource: String
  let filter: Filter?
}

struct Filter: Encodable {
  let id: String?
}

struct SyncServiceDataParams: Encodable {
  let service: String
  let lastSyncTime: String
}

struct SyncedServiceDataRow: Codable {
  let service: String
  let resource: String
  let value: EVYJson
}

struct SyncServiceDataResponse: Codable {
  let data: [SyncedServiceDataRow]
}

@MainActor
struct EVY {
  private static let localPrefix = "$local"
  private static let localPrefixWithSeparator = localPrefix + PROP_SEPARATOR

  static let publicStore = EVYDataStore(name: "public")
  static let privateStore = EVYDataStore(name: "private")
  static let cacheStore = EVYDataStore(name: "cache", inMemoryOnly: true)
  static let draftStore = EVYDraftStore(dataStore: cacheStore)
  static var activeCachePrefix: String?

  static func cacheQueryParams(_ query: [String: [String]], forPageId pageId: String) {
    activeCachePrefix = "\(pageId):"
    resolveQueryParams(query)
  }

  static func stripLocalPrefix(_ props: String) -> String {
    guard props.hasPrefix(localPrefixWithSeparator) else {
      return props
    }
    return String(props.dropFirst(localPrefixWithSeparator.count))
  }

  static func store(for props: String) -> (EVYDataStore, String) {
    let cleanProps = stripLocalPrefix(props)
    let isLocalProps = cleanProps != props
    return (isLocalProps ? privateStore : publicStore, cleanProps)
  }

  static func getUserData() throws {
    let userData = try EVYJson.from(localJSON: "user_data")
    let encodedUserData = try JSONEncoder().encode(userData)
    do {
      try EVY.publicStore.create(key: "user", data: encodedUserData)
    } catch EVYDataError.keyAlreadyExists {
      // Expected when startup bootstrapping runs after user data already exists.
    }
  }

  static func syncServiceData(service: String) async throws {
    let lastSyncTime =
      EVY.publicStore.oldestLastSyncedAt(keyPrefix: "\(service):")
      ?? "1970-01-01T00:00:00.000Z"
    let params = SyncServiceDataParams(
      service: service,
      lastSyncTime: lastSyncTime
    )
    let response = try await EVYAPIManager.shared.fetch(
      method: "syncServiceData",
      params: params,
      expecting: SyncServiceDataResponse.self
    )

    for row in response.data {
      let key = "\(row.service):\(row.resource)"
      let encoded = try JSONEncoder().encode(row.value)
      try publicStore.upsert(key: key, value: encoded)
    }
  }

  static func syncAllServices() async throws {
    let services = ["marketplace"]
    for service in services {
      try await syncServiceData(service: service)
    }
  }

  static func resolveQueryParams(_ query: [String: [String]]) {
    guard let prefix = activeCachePrefix else { return }

    for (queryKey, ids) in query {
      if queryKey == "id",
        storeResolvedEntityQueryParam(prefix: prefix, queryKey: nil, ids: ids)
      {
        continue
      }

      if storeResolvedEntityQueryParam(prefix: prefix, queryKey: queryKey, ids: ids) {
        continue
      }

      if publicStore.serviceName(forSyncedResource: queryKey) == nil {
        _ = storeRawQueryParam(prefix: prefix, queryKey: queryKey, ids: ids)
      }
    }
  }

  private static func storeResolvedEntityQueryParam(
    prefix: String,
    queryKey: String?,
    ids: [String]
  ) -> Bool {
    guard let id = ids.first else { return false }

    for candidate in resolvedEntityCollections(for: queryKey) {
      guard let collectionJson = try? candidate.data.decoded(),
        case .array(let collectionValues) = collectionJson,
        let matchingValue = collectionValues.first(where: { $0.identifierValue() == id }),
        let encodedMatchingValue = try? JSONEncoder().encode(matchingValue)
      else {
        continue
      }

      try? cacheStore.upsert(key: "\(prefix)\(candidate.cacheKey)", value: encodedMatchingValue)
      return true
    }

    return false
  }

  private static func resolvedEntityCollections(for queryKey: String?) -> [(cacheKey: String, data: EVYData)] {
    if let queryKey {
      let serviceName = publicStore.serviceName(forSyncedResource: queryKey)
      guard let data = collectionData(for: queryKey, serviceName: serviceName) else { return [] }
      return [(queryKey, data)]
    }

    let syncedCollections = (try? publicStore.getAll()) ?? []
    return syncedCollections.compactMap { collectionData in
      let keyParts = collectionData.key.split(separator: ":", maxSplits: 1).map(String.init)
      guard keyParts.count == 2 else { return nil }
      return (keyParts[1], collectionData)
    }
  }

  private static func storeRawQueryParam(prefix: String, queryKey: String, ids: [String]) -> Bool {
    let rawQueryValue: EVYJson =
      if ids.count == 1, let id = ids.first {
        .string(id)
      } else {
        .array(ids.map { .string($0) })
      }
    guard let encodedRawQueryValue = try? JSONEncoder().encode(rawQueryValue) else {
      return false
    }
    do {
      try cacheStore.upsert(key: "\(prefix)\(queryKey)", value: encodedRawQueryValue)
      return true
    } catch {
      return false
    }
  }

  private static func collectionData(for collectionKey: String, serviceName: String?) -> EVYData? {
    if let serviceName {
      return try? publicStore.getSyncedResource(resource: collectionKey, serviceName: serviceName)
    }
    return try? publicStore.getForBinding(key: collectionKey)
  }

  static func getSDUI() async throws -> [UI_Flow] {
    try await EVYAPIManager.shared.fetch(
      method: "get", params: GetParams(service: "evy", resource: "sdui", filter: nil),
      expecting: [UI_Flow].self)
  }

  static func getDataFromText(_ input: String) throws -> EVYJson {
    try _getDataFromText(input)
  }

  static func getDataFromProps(_ props: String) throws -> EVYJson {
    try _getDataFromProps(props)
  }

  static func getValueFromText(_ input: String, editing: Bool = false) throws -> EVYValue {
    try _getValueFromText(input, editing: editing)
  }

  static func parsePropsFromText(_ input: String) -> String {
    _parsePropsFromText(input)
  }

  static func watchTarget(for text: String) -> String {
    _watchTarget(for: text)
  }

  static func evaluateFromText(_ input: String) throws -> Bool {
    try _evaluateFromText(input)
  }

  static func formatData(json: EVYJson, format: String) throws -> String {
    try _formatData(json: json, format: format)
  }

  static func formatDataOrToString(json: EVYJson, format: String) throws -> String {
    if format.isEmpty {
      return json.toString()
    }
    return try formatData(json: json, format: format)
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
    guard !store.exists(key: cleanVariableName),
      draftStore.draftIfPresent(binding: binding) == nil
    else {
      return
    }
    let emptyData = initialData ?? "\"\"".data(using: .utf8)!
    do {
      try draftStore.upsert(binding: binding, data: emptyData)
    } catch {
      // Best-effort draft bootstrap; callers can still render from existing data.
    }
  }


  /// Converts a singular entity key into its plural backend resource name.
  ///
  /// Only the last underscore-separated segment is inflected. For example
  /// `selling_reason` becomes `selling_reasons` (not `sellings_reasons`).
  ///
  /// Uses Foundation's `AttributedString` inflection system as the source of truth.
  static func resourceName(forEntityKey entityKey: String) -> String {
    inflectLastSegment(of: entityKey, to: .plural)
  }

  /// Inflects the last underscore-separated segment of a key to the given grammatical number.
  private static func inflectLastSegment(of key: String, to number: Morphology.GrammaticalNumber) -> String {
    let parts = key.split(separator: "_").map(String.init)
    guard let lastPart = parts.last else { return key }
    return (parts.dropLast() + [inflect(lastPart, to: number)]).joined(separator: "_")
  }

  /// Inflects a word to the given grammatical number using Foundation's inflection system.
  private static func inflect(_ word: String, to number: Morphology.GrammaticalNumber) -> String {
    var morphology = Morphology()
    morphology.number = number

    var attrStr = AttributedString(word)
    attrStr[AttributeScopes.FoundationAttributes.InflectionRuleAttribute.self] = InflectionRule(morphology: morphology)

    let inflected = attrStr.inflected()
    return String(inflected.characters)
  }

  static func create(key: String, draftScopeId: String? = nil) throws {
    struct UpsertParams: Encodable {
      let service: String
      let resource: String
      let filter: Filter?
      let data: EVYJson
    }

    let resource = EVY.resourceName(forEntityKey: key)

    let existing: EVYData? = try? publicStore.get(key: key)
    let newId = UUID().uuidString
    let payload: EVYJson
    if let existing {
      payload = try existing.decoded()
      guard case .dictionary = payload else {
        throw EVYParamError.invalidProps
      }
    } else {
      payload = .dictionary([:])
    }

    var mergedPayload = payload

    let scopeForMerge = draftScopeId ?? draftStore.activeScopeId
    let draftEntries: [EVYData] = {
      guard let s = scopeForMerge else { return [] }
      return (try? draftStore.drafts(forScopeId: s)) ?? []
    }()
    for draftEntry in draftEntries {
      let draftValue = try draftEntry.decoded()
      if case .string(let s) = draftValue, s.isEmpty {
        continue
      }
      guard let binding = EVYDraft.Binding.parseDraftKey(draftEntry.key) else {
        continue
      }
      mergedPayload = EVYDraft.merge(binding: binding, value: draftValue, into: mergedPayload)
    }

    guard case .dictionary(var dict) = mergedPayload else {
      throw EVYParamError.invalidProps
    }
    dict["id"] = .string(newId)
    let dataWithId = EVYJson.dictionary(dict)
    let params = UpsertParams(
      service: "marketplace",
      resource: resource,
      filter: Filter(id: newId),
      data: dataWithId
    )
    if let existing {
      existing.data = try JSONEncoder().encode(dataWithId)
      existing.key = newId
    }

    Task { @MainActor in
      do {
        _ = try await EVYAPIManager.shared.fetch(
          method: "upsert",
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
        let wrapper = EVYData(key: "_draft", data: existingDraft.data)
        try wrapper.updateDataWithData(newData, props: remainingProps)
        existingDraft.data = wrapper.data
      }
      draftStore.notifyUpdate(binding: draftBinding)
    } else if store.exists(key: rootVariable) {
      let dataObj = try store.get(key: rootVariable)
      let remainingProps = Array(splitProps.dropFirst())
      if remainingProps.isEmpty {
        dataObj.data = newData
      } else {
        try dataObj.updateDataWithData(newData, props: remainingProps)
      }
      try store.update(props: splitProps, data: dataObj.data)
    } else {
      guard let draftBinding else {
        throw EVYDataError.keyNotFound
      }
      try draftStore.upsert(binding: draftBinding, data: newData)
    }
  }
}

// MARK: - Preview Mock Data

/// Shared hard-coded mock data for SwiftUI previews.
/// Use these instead of network-dependent AsyncPreview / EVYPreviewFixtures.
@MainActor
enum EVYPreviewMockData {

  // MARK: - Item (used by most row previews)

  static let item = """
    {
      "id": "preview-item-1",
      "title": "Amazing Fridge",
      "price": 150,
      "description": "A fantastic fridge in great condition",
      "condition": "cond-1",
      "dimensions": {
        "width": 60,
        "height": 180,
        "depth": 65,
        "weight": 75
      },
      "photo_ids": ["photo-1", "photo-2", "photo-3"],
      "tags": ["energy-efficient", "frost-free"]
    }
    """

  // MARK: - Conditions

  static let conditions = """
    [
      { "id": "cond-1", "value": "Like New" },
      { "id": "cond-2", "value": "Good" },
      { "id": "cond-3", "value": "Fair" }
    ]
    """

  // MARK: - Durations

  static let durations = """
    [
      { "id": "dur-1", "value": "30 min" },
      { "id": "dur-2", "value": "1 hour" },
      { "id": "dur-3", "value": "2 hours" }
    ]
    """

  // MARK: - Selling Reasons

  static let sellingReasons = """
    [
      { "id": "reason-1", "value": "Moving out" },
      { "id": "reason-2", "value": "Upgrading" },
      { "id": "reason-3", "value": "No longer needed" },
      { "id": "reason-4", "value": "Other" }
    ]
    """

  // MARK: - Tags

  static let tags = """
    [
      "energy-efficient",
      "frost-free",
      "stainless-steel"
    ]
    """

  // MARK: - Timeslots

  static let timeslots = """
    [
      {
        "header": "Wed",
        "date": "8 nov.",
        "timeslots": [
          { "timeslot": "11:30", "available": true },
          { "timeslot": "12:00", "available": true }
        ]
      },
      {
        "header": "Thu",
        "date": "9 nov.",
        "timeslots": [
          { "timeslot": "10:30", "available": false },
          { "timeslot": "11:00", "available": true },
          { "timeslot": "12:00", "available": true }
        ]
      },
      {
        "header": "Fri",
        "date": "10 nov.",
        "timeslots": [
          { "timeslot": "10:30", "available": true },
          { "timeslot": "12:00", "available": false },
          { "timeslot": "12:30", "available": true }
        ]
      }
    ]
    """

  // MARK: - User (for $local bindings)

  static let user = """
    {
      "id": "preview-user-1",
      "address": {
        "line1": "42 Preview Lane",
        "city": "Preview City",
        "postcode": "2000",
        "country": "Australia"
      }
    }
    """

  // MARK: - Helpers

  /// Upsert mock data into the public store.
  static func seed(key: String, json: String) {
    guard let data = json.data(using: .utf8) else { return }
    try? EVY.publicStore.upsert(key: key, value: data, notify: false)
  }

  /// Seed the most commonly needed keys for row previews.
  static func seedCommon() {
    seed(key: "item", json: item)
    seed(key: "conditions", json: conditions)
    seed(key: "durations", json: durations)
    seed(key: "selling_reasons", json: sellingReasons)
    seed(key: "tags", json: tags)
    seed(key: "timeslots", json: timeslots)
  }

  /// Decode a UI_Row from a JSON string. Returns nil on failure.
  static func decodeRow(from json: String) -> UI_Row? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(UI_Row.self, from: data)
  }
}

@MainActor
struct EVYPreviewRow: View {
  private let row: UI_Row?
  private let failureMessage: String

  init(
    json: String,
    failureMessage: String,
    seed: @MainActor () -> Void = EVYPreviewMockData.seedCommon
  ) {
    seed()
    self.row = EVYPreviewMockData.decodeRow(from: json)
    self.failureMessage = failureMessage
  }

  var body: some View {
    if let row {
      EVYRow(row: row)
    } else {
      Text(failureMessage)
    }
  }
}
