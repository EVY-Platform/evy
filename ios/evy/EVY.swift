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
  static let draftStore = EVYDraftStore()

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
    for (queryKey, ids) in query {
      let serviceName = publicStore.serviceName(forSyncedResource: queryKey)
      guard let id = ids.first,
        let collectionData = collectionData(for: queryKey, serviceName: serviceName),
        let collectionJson = try? collectionData.decoded(),
        case .array(let collectionValues) = collectionJson,
        let matchingValue = collectionValues.first(where: { $0.identifierValue() == id }),
        let encodedMatchingValue = try? JSONEncoder().encode(matchingValue)
      else {
        continue
      }
      try? publicStore.upsert(key: queryKey, value: encodedMatchingValue)
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

  static func create(key: String, draftScopeId: String? = nil) throws {
    struct UpsertParams: Encodable {
      let service: String
      let resource: String
      let filter: Filter?
      let data: EVYJson
    }

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
      resource: key,
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

@MainActor
enum EVYPreviewFixtures {
  /// Seed preview data by syncing services and creating a local "items" key
  /// from the first marketplace item. **Preview-only** – not used at runtime.
  static func seedData() async throws {
    try await EVY.syncAllServices()
    let itemsData = try EVY.publicStore.get(key: "marketplace:items")
    let items = try itemsData.decoded()
    let firstItem: Data
    if case .array(let arr) = items, let first = arr.first {
      firstItem = try JSONEncoder().encode(first)
    } else {
      firstItem = try JSONEncoder().encode(EVYJson.dictionary([:]))
    }
    try EVY.publicStore.create(key: "items", data: firstItem)
  }

  static func getRow(_ props: [String]) async throws -> UI_Row {
    try await seedData()
    let flowData = try await EVYAPIManager.shared.fetch(
      method: "get", params: GetParams(service: "evy", resource: "sdui", filter: nil),
      expecting: EVYJson.self)
    let rowData = try JSONEncoder().encode(flowData.parseProp(props: props))
    return try JSONDecoder().decode(UI_Row.self, from: rowData)
  }
}

struct AsyncPreview<VisualContent: View, ViewData>: View {
  var viewBuilder: (ViewData) -> VisualContent
  var view: () async throws -> ViewData?

  @State private var viewData: ViewData?
  @State private var error: Error?

  var body: some View {
    safeView.task {
      do {
        self.viewData = try await view()
      } catch {
        self.error = error
      }
    }
  }

  @ViewBuilder
  private var safeView: some View {
    if let viewData {
      viewBuilder(viewData)
    } else if let error {
      Text(error.localizedDescription)
    } else {
      Text("Building view...")
    }
  }
}
