//
//  EVYScope.swift
//  evy
//

import SwiftUI

struct EVYScope: Equatable {
  let cacheScopeId: String?
  let draftScopeId: String?

  static let empty = EVYScope(cacheScopeId: nil, draftScopeId: nil)

  /// The scope implied by the global statics.
  ///
  /// Transitional: resolution used to read those statics directly, so every
  /// call site that has not yet been given an explicit scope falls back to
  /// this and behaves exactly as before. Removed once nothing needs it.
  @MainActor
  static var legacyGlobal: EVYScope {
    EVYScope(
      cacheScopeId: EVY.activeCacheScopeId,
      draftScopeId: EVY.draftStore.activeScopeId
    )
  }
}

private struct EVYScopeEnvironmentKey: EnvironmentKey {
  static let defaultValue = EVYScope.empty
}

extension EnvironmentValues {
  var evyScope: EVYScope {
    get { self[EVYScopeEnvironmentKey.self] }
    set { self[EVYScopeEnvironmentKey.self] = newValue }
  }
}
