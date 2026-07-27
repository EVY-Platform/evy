//
//  EVYState.swift
//  evy
//

import Foundation
import Observation

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

    func isAffected(by change: EVYValueChange) -> Bool {
      change.affects(watchSegments: segments)
    }
  }

  private var _value: T
  @ObservationIgnored private var observerTokens: [NSObjectProtocol] = []
  /// The scope this state belongs to, captured when it is created.
  ///
  /// A recompute can fire long after some other page became active, so
  /// resolving against whatever the globals happen to say at that moment reads
  /// the wrong drafts and cache. Pinning the scope makes a recompute produce
  /// the same value regardless of what else is on screen.
  @ObservationIgnored private let scope: EVYScope
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
    observerTokens.append(
      NotificationCenter.default.addObserver(
        forName: .evyValueChanged,
        object: nil,
        queue: nil
      ) { [weak self] notification in
        guard let self else { return }
        let change = EVYValueChange(notification: notification)
        // `Watch.isAffected` is main-actor isolated like the recompute below,
        // so both run inside the same asserted region.
        MainActor.assumeIsolated {
          guard watches.contains(where: { $0.isAffected(by: change) }) else {
            return
          }
          self.value = EVY.withScope(self.scope) { recompute() }
        }
      }
    )
  }

  init(watches: [String], scope: EVYScope? = nil, setter: @escaping () -> T) {
    // Constructed while its own page is active, so the current scope is this
    // state's scope unless the caller knows better.
    self.scope = scope ?? .ambient
    // Under the pinned scope too: a view can be built while another page is
    // active, so the globals are not reliably this state's scope even now.
    _value = EVY.withScope(self.scope) { setter() }
    guard !watches.isEmpty else { return }
    registerObserver(watchTargets: watches, recompute: setter)
  }

  convenience init(
    textToWatch text: String?,
    scope: EVYScope? = nil,
    setter: @escaping () -> T
  ) {
    self.init(
      watches: text.map { EVY.watchTargets(for: $0) } ?? [],
      scope: scope,
      setter: setter)
  }

  init(staticString: T) {
    scope = .empty
    _value = staticString
  }

  deinit {
    for observerToken in observerTokens {
      NotificationCenter.default.removeObserver(observerToken)
    }
  }
}
