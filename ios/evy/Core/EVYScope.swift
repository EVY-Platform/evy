//
//  EVYScope.swift
//  evy
//

import SwiftUI

struct EVYScope: Equatable {
  let cacheScopeId: String?
  let draftScopeId: String?

  static let empty = EVYScope(cacheScopeId: nil, draftScopeId: nil)

  /// A scope that swaps only the cache, keeping the active draft scope.
  ///
  /// Cache scoping and draft scoping move independently: a view can render
  /// another page's cached data while still writing drafts to its own page.
  @MainActor
  static func cache(_ cacheScopeId: String?) -> EVYScope {
    EVYScope(cacheScopeId: cacheScopeId, draftScopeId: EVY.draftStore.activeScopeId)
  }

  /// The scope implied by the global statics - whichever page is active.
  ///
  /// Resolution and mutation fall back to this when handed no scope of their
  /// own. `EVY+Mutations` still reads the active cache scope ambiently, and
  /// SwiftUI initialisers cannot read `@Environment`, so a state built outside
  /// a row wrapper has nothing else to go on.
  ///
  /// Rows on a page are handed an explicit scope for reads, and run their
  /// actions inside `withScope`, so neither their reads nor their writes come
  /// through here. This is the floor, not the normal path.
  @MainActor
  static var ambient: EVYScope {
    EVYScope(
      cacheScopeId: EVY.activeCacheScopeId,
      draftScopeId: EVY.draftStore.activeScopeId
    )
  }
}

extension EVY {
  /// Runs `body` with `scope` installed, restoring whatever was there before.
  ///
  /// Resolution still reads the globals when no scope is passed explicitly, and
  /// closures captured in a SwiftUI `init` cannot be handed one - `@Environment`
  /// is not readable there. This is the bridge: a caller that knows its scope
  /// can guarantee the work inside sees it, whatever else has happened since.
  /// Symmetric and exception-safe, unlike the save/assign/defer blocks it
  /// replaces.
  @MainActor
  static func withScope<T>(_ scope: EVYScope, _ body: () throws -> T) rethrows -> T {
    let previousCache = activeCacheScopeId
    let previousDraft = draftStore.activeScopeId
    activeCacheScopeId = scope.cacheScopeId
    draftStore.activeScopeId = scope.draftScopeId
    defer {
      activeCacheScopeId = previousCache
      draftStore.activeScopeId = previousDraft
    }
    return try body()
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
