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
        if watches.contains(where: { $0.isAffected(by: change) }) {
          MainActor.assumeIsolated {
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

  convenience init(textToWatch text: String?, setter: @escaping () -> T) {
    self.init(watches: text.map { EVY.watchTargets(for: $0) } ?? [], setter: setter)
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
