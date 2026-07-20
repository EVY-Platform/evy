//
//  EVYRouting.swift
//  evy
//

import SwiftUI

struct Route: Hashable, Codable {
  let flowId: String
  let pageId: String
  let query: [String: [String]]

  init(flowId: String, pageId: String, query: [String: [String]] = [:]) {
    self.flowId = flowId
    self.pageId = pageId
    self.query = query
  }
}

enum ActionOperation: Hashable {
  case navigate(Route)
  case highlightRequired(String)
  case close
}

func routesAfterNavigating(
  from currentRoutes: [Route],
  to route: Route,
  homeFlowId: String
) -> [Route] {
  guard route.flowId != homeFlowId else { return [] }

  var updatedRoutes = currentRoutes
  if let existingRouteIndex = updatedRoutes.lastIndex(of: route) {
    updatedRoutes.removeSubrange(existingRouteIndex...)
  } else {
    updatedRoutes.append(route)
  }
  return updatedRoutes
}

struct ActionEnvironmentKey: EnvironmentKey {
  static let defaultValue: (ActionOperation) -> Void = { _ in }
}

struct SheetDismissEnvironmentKey: EnvironmentKey {
  static let defaultValue: (() -> Void)? = nil
}

extension EnvironmentValues {
  var action: (ActionOperation) -> Void {
    get { self[ActionEnvironmentKey.self] }
    set { self[ActionEnvironmentKey.self] = newValue }
  }

  var sheetDismiss: (() -> Void)? {
    get { self[SheetDismissEnvironmentKey.self] }
    set { self[SheetDismissEnvironmentKey.self] = newValue }
  }
}
