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
