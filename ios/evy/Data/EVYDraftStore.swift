//
//  EVYDraftStore.swift
//  evy
//

import Foundation

@MainActor
final class EVYDraftStore {
  private let dataStore: EVYDataStore

  var activeScopeId: String?

  init(dataStore: EVYDataStore) {
    self.dataStore = dataStore
  }

  func drafts(forScopeId scopeId: String) throws -> [EVYData] {
    try dataStore.getAll(namespace: EVYNamespace.draft, resource: scopeId)
  }

  func draftIfPresent(binding: EVYDraft.Binding) -> EVYData? {
    try? dataStore.get(
      namespace: EVYNamespace.draft, resource: binding.scopeId, id: binding.draftKey)
  }

  /// Longest draft whose path is a prefix of `splitProps` (exact match first).
  /// Lets `{pickup_address.street}` resolve against a draft written to `{pickup_address}`.
  func draftMatch(
    splitProps: [String],
    scopeId: String
  ) throws -> (binding: EVYDraft.Binding, draft: EVYData, remainingProps: [String])? {
    guard !splitProps.isEmpty else { return nil }
    for prefixLength in stride(from: splitProps.count, through: 1, by: -1) {
      let prefixProps = Array(splitProps.prefix(prefixLength)).joined(separator: PROP_SEPARATOR)
      let binding = try binding(fromParsedProps: prefixProps, scopeId: scopeId)
      guard let draft = draftIfPresent(binding: binding) else { continue }
      let remainingProps = EVYDraft.remainingPropsAfterDraftPrefix(
        splitProps: splitProps,
        binding: binding
      )
      return (binding, draft, remainingProps)
    }
    return nil
  }

  func notifyUpdate(binding: EVYDraft.Binding) {
    postValueChanged(key: binding.notificationKey)

    guard let entityKey = EVYDraft.Scope.entityKey(fromScopeId: binding.scopeId),
      !binding.notificationKey.isEmpty,
      !binding.notificationKey.hasPrefix("\(entityKey)\(PROP_SEPARATOR)")
    else {
      return
    }

    postValueChanged(key: "\(entityKey)\(PROP_SEPARATOR)\(binding.notificationKey)")
  }

  func deleteDrafts(scopeId: String? = nil) {
    if let scopeId {
      try? dataStore.deleteAll(namespace: EVYNamespace.draft, resource: scopeId)
    } else {
      try? dataStore.deleteAll(namespace: EVYNamespace.draft)
    }
  }

  func binding(fromParsedProps parsed: String, scopeId: String? = nil) throws -> EVYDraft.Binding {
    try EVYDraft.binding(
      parsedProps: parsed,
      scopeId: scopeId ?? activeScopeId
    )
  }

  private func postValueChanged(key: String) {
    EVYValueChange.post(key: key)
  }
}
