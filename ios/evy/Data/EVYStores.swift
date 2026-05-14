//
//  EVYStores.swift
//  evy
//
//  Created by Geoffroy Lesage on 27/4/2026.
//

import Foundation
import Observation

enum EVYDataError: Error {
  case keyAlreadyExists
  case keyNotFound
}

extension Notification.Name {
  static let evyDataUpdated = Notification.Name("EVYDataUpdated")
  static let evyErrorOccurred = Notification.Name("EVYErrorOccurred")
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

  init(setter: @escaping () -> T) {
    _value = setter()

    observerTokens.append(
      NotificationCenter.default.addObserver(
        forName: .evyDataUpdated,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        Task { @MainActor in
          self?.value = setter()
        }
      }
    )
  }

  init(watch: String, setter: @escaping (_ input: String) -> T) {
    _value = setter(watch)

    let watchProps = EVY.parsePropsFromText(watch)
    let watchSegments = watchProps.components(separatedBy: PROP_SEPARATOR)

    observerTokens.append(
      NotificationCenter.default.addObserver(
        forName: .evyDataUpdated,
        object: nil,
        queue: .main
      ) { [weak self] notif in
        Task { @MainActor in
          guard let notifProp = notif.object as? String else {
            self?.value = setter(watch)
            return
          }

          let notifSegments = notifProp.components(separatedBy: PROP_SEPARATOR)
          let minLen = min(watchSegments.count, notifSegments.count)

          // If we get a notification for "item" and we were watching "item.title" then we want to update
          let prefixMatch = watchSegments.prefix(minLen) == notifSegments.prefix(minLen)

          if prefixMatch { self?.value = setter(watch) }
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
    try dataStore.getAll(
      keyPrefix: EVYDraft.Binding.draftKeyPrefix(forScopeId: scopeId)
    )
  }

  func draftIfPresent(binding: EVYDraft.Binding) -> EVYData? {
    try? dataStore.get(key: binding.draftKey)
  }

  func upsert(binding: EVYDraft.Binding, data: Data) throws {
    try dataStore.upsert(key: binding.draftKey, value: data, notify: false)
    notifyUpdate(binding: binding)
  }

  func notifyUpdate(binding: EVYDraft.Binding) {
    NotificationCenter.default.post(
      name: .evyDataUpdated,
      object: binding.notificationKey
    )

    guard let entityKey = EVYDraft.Scope.entityKey(fromScopeId: binding.scopeId),
      !binding.notificationKey.isEmpty,
      !binding.notificationKey.hasPrefix("\(entityKey)\(PROP_SEPARATOR)")
    else {
      return
    }

    NotificationCenter.default.post(
      name: .evyDataUpdated,
      object: "\(entityKey)\(PROP_SEPARATOR)\(binding.notificationKey)"
    )
  }

  func deleteDrafts(scopeId: String? = nil) {
    if let scopeId {
      dataStore.deleteAll(
        keyPrefix: EVYDraft.Binding.draftKeyPrefix(forScopeId: scopeId)
      )
    } else {
      dataStore.deleteAll()
    }
  }

  func binding(fromParsedProps parsed: String, scopeId: String? = nil) throws -> EVYDraft.Binding {
    try EVYDraft.binding(
      parsedProps: parsed,
      scopeId: scopeId ?? activeScopeId
    )
  }
}
