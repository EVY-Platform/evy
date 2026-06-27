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

struct EVYUserAlert {
  let title: String
  let message: String?
}

extension Notification.Name {
  static let evyDataChanged = Notification.Name("EVYDataChanged")
  static let evyErrorOccurred = Notification.Name("EVYErrorOccurred")
  static let evyUserAlertRequested = Notification.Name("EVYUserAlertRequested")
}

struct EVYDataChange {
  static let userInfoKey = "evyDataChange"
  let namespace: String
  let resource: String
  let id: String

  var recordKey: String { "\(namespace):\(resource):\(id)" }
}

@MainActor
@Observable class EVYState<T: Equatable> {
  @MainActor
  private struct Watch: Equatable {
    let segments: [String]

    init(_ watch: String) {
      guard !watch.isEmpty else {
        segments = []
        return
      }
      segments = EVY.parsePropsFromText(watch).components(separatedBy: PROP_SEPARATOR)
    }

    func isAffected(by notificationKey: String) -> Bool {
      guard !segments.isEmpty else { return false }
      let notificationSegments = notificationKey.components(separatedBy: PROP_SEPARATOR)
      let comparedSegmentCount = min(segments.count, notificationSegments.count)
      return segments.prefix(comparedSegmentCount)
        == notificationSegments.prefix(comparedSegmentCount)
    }
  }

  private var _value: T
  @ObservationIgnored private var observerTokens: [NSObjectProtocol] = []
  var value: T {
    get { _value }
    set {
      if _value != newValue { _value = newValue }
    }
  }

  private func registerObserver(
    watchTargets: [String],
    recompute: @escaping () -> T
  ) {
    let watches = watchTargets.map(Watch.init)
    // Observer runs synchronously on the posting thread (no queue specified).
    // All posters of `.evyDataChanged` are `@MainActor`-isolated, so the block runs on
    // the main thread; `MainActor.assumeIsolated` bridges to MainActor without an async hop.
    // Synchronous semantics matter: it lets `withAnimation { writeData(...) }` capture the
    // notification-driven `EVYState.value` mutation inside the same animation transaction.
    observerTokens.append(
      NotificationCenter.default.addObserver(
        forName: .evyDataChanged,
        object: nil,
        queue: nil
      ) { [weak self] notif in
        MainActor.assumeIsolated {
          guard let self else { return }
          guard let notifProp = notif.object as? String else {
            self.value = recompute()
            return
          }
          if watches.contains(where: { $0.isAffected(by: notifProp) }) {
            self.value = recompute()
          }
        }
      }
    )
  }

  init(watches: [String], setter: @escaping () -> T) {
    _value = setter()
    registerObserver(watchTargets: watches, recompute: setter)
  }

  convenience init(textToWatch text: String, setter: @escaping () -> T) {
    self.init(watches: EVY.watchTargets(for: text), setter: setter)
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
