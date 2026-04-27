//
//  EVY.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/6/2024.
//

import Foundation
import SwiftUI

public enum EVYParamError: Error {
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
  static let data = EVYDataManager()

  static func getUserData() throws {
    let userData = try EVYJson.from(localJSON: "user_data")
    let encodedUserData = try JSONEncoder().encode(userData)
    do {
      try EVY.data.create(key: "user", data: encodedUserData)
    } catch EVYDataError.keyAlreadyExists {
    }
  }

  private static func upsertSyncedData(key: String, data encodedData: Data) throws {
    try EVY.data.upsert(key: key, value: encodedData)
  }

  static func syncServiceData(service: String) async throws {
    let params = SyncServiceDataParams(
      service: service,
      lastSyncTime: "1970-01-01T00:00:00.000Z"
    )
    let response = try await EVYAPIManager.shared.fetch(
      method: "syncServiceData",
      params: params,
      expecting: SyncServiceDataResponse.self
    )

    for row in response.data {
      let key = "\(row.service):\(row.resource)"
      let encoded = try JSONEncoder().encode(row.value)
      try upsertSyncedData(key: key, data: encoded)
    }
  }

  static func syncAllServices() async throws {
    let services = ["marketplace"]
    for service in services {
      try await syncServiceData(service: service)
    }
  }

  static func getItemData() throws -> Data {
    let itemsData = try EVY.data.get(key: "marketplace:items")
    let items = try itemsData.decoded()
    if case .array(let arr) = items, let first = arr.first {
      return try JSONEncoder().encode(first)
    }
    return try JSONEncoder().encode(EVYJson.dictionary([:]))
  }

  static func getData() async throws -> Data {
    try await syncAllServices()
    return try getItemData()
  }

  static func getSDUI() async throws -> [UI_Flow] {
    try await EVYAPIManager.shared.fetch(
      method: "get", params: GetParams(service: "evy", resource: "sdui", filter: nil),
      expecting: [UI_Flow].self)
  }

  static func createItem() async throws {
    try EVY.data.create(key: "item", data: try await getData())
  }

  static func getRow(_ props: [String]) async throws -> UI_Row {
    try await createItem()
    let flowData = try await EVYAPIManager.shared.fetch(
      method: "get", params: GetParams(service: "evy", resource: "sdui", filter: nil),
      expecting: EVYJson.self)
    let rowData = try JSONEncoder().encode(flowData.parseProp(props: props))
    return try JSONDecoder().decode(UI_Row.self, from: rowData)
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
    guard let resolvedScopeId = scopeId ?? data.activeDraftScopeId,
      let binding = try? data.draftBinding(
        fromParsedProps: variableName,
        scopeId: resolvedScopeId
      )
    else {
      return
    }
    guard !data.exists(key: variableName),
      !data.hasDraft(binding: binding)
    else {
      return
    }
    let emptyData = initialData ?? "\"\"".data(using: .utf8)!
    do {
      try data.createDraft(binding: binding, data: emptyData)
    } catch {
    }
  }

  static func create(key: String, draftScopeId: String? = nil) throws {
    struct UpsertParams: Encodable {
      let service: String
      let resource: String
      let filter: Filter?
      let data: EVYJson
    }

    let existing = try data.get(key: key)
    let newId = UUID().uuidString
    let payload = try existing.decoded()
    guard case .dictionary = payload else {
      throw EVYParamError.invalidProps
    }

    var mergedPayload = payload

    let scopeForMerge = draftScopeId ?? data.activeDraftScopeId
    let draftRows: [EVYDraft] = {
      guard let s = scopeForMerge else { return [] }
      return (try? data.drafts(forScopeId: s)) ?? []
    }()
    for draftRow in draftRows {
      let draftValue = try draftRow.decoded()
      if case .string(let s) = draftValue, s.isEmpty {
        continue
      }
      mergedPayload = draftRow.merged(into: mergedPayload, draftValue: draftValue)
    }

    guard case .dictionary(var dict) = mergedPayload else {
      throw EVYParamError.invalidProps
    }
    dict["id"] = .string(newId)
    let dataWithId = EVYJson.dictionary(dict)
    let params = UpsertParams(
      service: "marketplace",
      resource: "\(key)s",
      filter: Filter(id: newId),
      data: dataWithId
    )
    existing.data = try JSONEncoder().encode(dataWithId)
    existing.key = newId

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
    let splitProps = try splitPropsFromText(variableName)
    let rootVariable = splitProps.first!
    let resolvedScopeId = scopeId ?? data.activeDraftScopeId
    let draftBinding = try resolvedScopeId.map {
      try data.draftBinding(fromParsedProps: variableName, scopeId: $0)
    }

    if let draftBinding,
      let existingDraft = data.draftIfPresent(binding: draftBinding)
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
      NotificationCenter.default.post(
        name: .evyDataUpdated,
        object: draftBinding.notificationKey
      )
    } else if data.exists(key: rootVariable) {
      let dataObj = try data.get(key: rootVariable)
      let remainingProps = Array(splitProps.dropFirst())
      if remainingProps.isEmpty {
        dataObj.data = newData
      } else {
        try dataObj.updateDataWithData(newData, props: remainingProps)
      }
      try data.update(props: splitProps, data: dataObj.data)
    } else {
      guard let draftBinding else {
        throw EVYDataError.keyNotFound
      }
      try data.upsertDraft(binding: draftBinding, data: newData)
    }
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
