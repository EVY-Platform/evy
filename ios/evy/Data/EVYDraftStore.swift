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
