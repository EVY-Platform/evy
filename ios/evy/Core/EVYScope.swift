//
//  EVYScope.swift
//  evy
//

import SwiftUI

struct EVYScope: Equatable {
  let cacheScopeId: String?
  let draftScopeId: String?

  static let empty = EVYScope(cacheScopeId: nil, draftScopeId: nil)
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
