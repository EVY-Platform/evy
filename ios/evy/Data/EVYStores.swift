//
//  EVYStores.swift
//  evy
//
//  Created by Geoffroy Lesage on 27/4/2026.
//

import Foundation
import Observation

enum EVYDataError: Error {
  case keyNotFound
  case keyAlreadyExists
}

extension Notification.Name {
  static let evyDataChanged = Notification.Name("EVYDataChanged")
  static let evyErrorOccurred = Notification.Name("EVYErrorOccurred")
}

@MainActor
func dataChangeKey(_ notificationKey: String, affects watch: String) -> Bool {
    guard !watch.isEmpty else { return false }
    let watchProps = EVY.parsePropsFromText(watch)
    let watchSegments = watchProps.components(separatedBy: PROP_SEPARATOR)
    let notifSegments = notificationKey.components(separatedBy: PROP_SEPARATOR)
    let minLen = min(watchSegments.count, notifSegments.count)
    return watchSegments.prefix(minLen) == notifSegments.prefix(minLen)
}

@MainActor
@Observable class EVYState<T: Equatable> {
  private var _value: T
  @ObservationIgnored private var observerTokens: [NSObjectProtocol] = []
  var value: T {
    get { _value }
    set {
      if _value != newValue { _value = newValue }
    }
  }

  init(watch: String, setter: @escaping (_ input: String) -> T) {
    _value = setter(watch)

    observerTokens.append(
      NotificationCenter.default.addObserver(
        forName: .evyDataChanged,
        object: nil,
        queue: .main
      ) { [weak self] notif in
        Task { @MainActor in
          guard let notifProp = notif.object as? String else {
            self?.value = setter(watch)
            return
          }

          if dataChangeKey(notifProp, affects: watch) { self?.value = setter(watch) }
        }
      }
    )
  }

  init(staticString: T) {
    _value = staticString
  }

  deinit {
    for observerToken in observerTokens {
      NotificationCenter.default.removeObserver(observerToken)
    }
  }
}

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
    NotificationCenter.default.post(
      name: .evyDataChanged,
      object: binding.notificationKey
    )

    guard let entityKey = EVYDraft.Scope.entityKey(fromScopeId: binding.scopeId),
      !binding.notificationKey.isEmpty,
      !binding.notificationKey.hasPrefix("\(entityKey)\(PROP_SEPARATOR)")
    else {
      return
    }

    NotificationCenter.default.post(
      name: .evyDataChanged,
      object: "\(entityKey)\(PROP_SEPARATOR)\(binding.notificationKey)"
    )
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
}
