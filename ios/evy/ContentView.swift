//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
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
enum NavOperation: Hashable {
  case navigate(Route)
  case create(String)
  case highlightRequired(String)
  case close
}

struct NavigateEnvironmentKey: EnvironmentKey {
  static let defaultValue: (NavOperation) -> Void = { _ in }
}

extension EnvironmentValues {
  var navigate: (NavOperation) -> Void {
    get { self[NavigateEnvironmentKey.self] }
    set { self[NavigateEnvironmentKey.self] = newValue }
  }
}

private let DEFAULT_HOME_FLOW_ID = "f267c629-2594-4770-8cec-d5324ebb4058"

private var HOME_FLOW_ID: String {
  let configuredHomeFlowId = ProcessInfo.processInfo.environment["HOME_FLOW_ID"] ?? ""
  return configuredHomeFlowId.isEmpty ? DEFAULT_HOME_FLOW_ID : configuredHomeFlowId
}

struct ContentView: View {
  @State private var flows: [UI_Flow] = []
  @State private var routes: [Route] = []
  @State private var showingAlert = false
  @State private var alertTitle = ""
  @State private var alertMessage = ""
  @State private var loading = true

  private var currentFlowId: String {
    routes.last?.flowId ?? HOME_FLOW_ID
  }

  private func showError(_ error: Error) {
    alertTitle = "Error"
    alertMessage = error.localizedDescription
    showingAlert = true
  }

  private func handleNavigationData(_ navOperation: NavOperation) {
    switch navOperation {
    case .navigate(let route):
      if let existing = routes.lastIndex(of: route) {
        routes.removeSubrange(existing...)
      } else {
        routes.append(route)
      }

      if currentFlowId == route.flowId {
        break
      }

      guard flows.first(where: { $0.id == route.flowId }) != nil else {
        alertTitle = "Unable to load flow"
        alertMessage = "Please check your internet connection"
        showingAlert = true
        routes.removeLast()
        break
      }

    case .create(let key):
      createFlow(key: key)

    case .highlightRequired(let fieldName):
      alertTitle = "Missing information"
      alertMessage = "\(fieldName) is required"
      showingAlert = true

    case .close:
      if let existing = routes.firstIndex(where: { $0.flowId == currentFlowId }) {
        routes.removeSubrange(existing...)
      } else {
        routes.removeAll()
      }
    }
  }

  private func createFlow(key: String) {
    do {
      let draftScope = EVYDraft.createMergeScopeId(flowId: currentFlowId, entityKey: key)
      try EVY.create(key: key, draftScopeId: draftScope)
    } catch {
      showError(error)
      return
    }

    if let existing = routes.firstIndex(where: { $0.flowId == currentFlowId }) {
      routes.removeSubrange(existing...)
    } else {
      routes.removeAll()
    }
  }

  @ViewBuilder
  private var homeContent: some View {
    if loading {
      ProgressView()
        .controlSize(.large)
    } else if let homeFlow = flows.first(where: { $0.id == HOME_FLOW_ID }) {
      if homeFlow.pages.isEmpty {
        VStack(spacing: 20) {
          Text("This flow has no pages")
            .font(.evyTitle)
            .foregroundColor(.gray)
        }
      } else if let homePage = homeFlow.pages.first {
        homePage
          .environment(\.navigate) { navOperation in
            handleNavigationData(navOperation)
          }
      }
    } else {
      VStack(spacing: 20) {
        Text("Failed to load flows")
          .font(.evyTitle)
          .foregroundColor(.red)
        Text("Please check your connection and try again")
          .font(.subheadline)
          .foregroundColor(.gray)
      }
    }
  }

  var body: some View {
    NavigationStack(path: $routes) {
      homeContent
        .task {
          if !flows.isEmpty { return }

          do {
            try EVY.getUserData()
            try await EVY.syncAllServices()
            flows = try await EVY.getSDUI()
            loading = false
          } catch let error as EVYRPCError {
            alertTitle = "Error"
            alertMessage = error.localizedDescription
            showingAlert = true
            loading = false
          } catch {
            alertTitle = "Error"
            alertMessage = error.localizedDescription
            showingAlert = true
            loading = false
          }
        }
        .navigationDestination(for: Route.self) { route in
          if let flow = flows.first(where: { $0.id == route.flowId }),
            let page = flow.getPageById(route.pageId)
          {
            let _ = EVY.cacheQueryParams(route.query, forPageId: route.pageId)

            page
              .environment(
                \.evyDraftScopeId,
                EVYFlowDraftScopeResolver.draftScopeId(for: route, flows: flows)
              )
              .environment(\.navigate) { navOperation in
                handleNavigationData(navOperation)
              }
          } else {
            Text("Flow not found")
              .foregroundColor(.red)
          }
        }
    }
    .alert(isPresented: $showingAlert) {
      Alert(
        title: Text(alertTitle),
        message: Text(alertMessage),
        dismissButton: .default(Text("Ok")))
    }
    .onChange(of: routes) { oldRoutes, newRoutes in
      let previousFlowId = oldRoutes.last?.flowId ?? HOME_FLOW_ID
      let newFlowId = newRoutes.last?.flowId ?? HOME_FLOW_ID

      guard newFlowId != previousFlowId else {
        return
      }

      let createKeys = EVYFlowDraftScopeResolver.extractCreateKeys(
        from: flows.first(where: { $0.id == previousFlowId })
      )
      for key in createKeys {
        EVY.draftStore.deleteDrafts(
          scopeId: EVYDraft.createMergeScopeId(
            flowId: previousFlowId,
            entityKey: key
          )
        )
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: .evyFlowUpdated)) { notification in
      guard let updatedFlow = notification.object as? UI_Flow else { return }

      var nextFlows = flows
      if let index = nextFlows.firstIndex(where: { $0.id == updatedFlow.id }) {
        nextFlows[index] = updatedFlow
      } else {
        nextFlows.append(updatedFlow)
      }
      flows = nextFlows
    }
    .onReceive(NotificationCenter.default.publisher(for: .evyErrorOccurred)) { notification in
      if let error = notification.object as? Error {
        if loading { loading = false }
        showError(error)
      }
    }
  }

}

@MainActor
enum EVYFlowDraftScopeResolver {
  static func draftScopeId(for route: Route, flows: [UI_Flow]) -> String? {
    guard let flow = flows.first(where: { $0.id == route.flowId }) else { return nil }
    let keys = extractCreateKeys(from: flow)
    if let k = keys.sorted().first {
      return EVYDraft.createMergeScopeId(flowId: route.flowId, entityKey: k)
    }
    return "\(route.flowId):browse"
  }

  static func extractCreateKeys(from flow: UI_Flow?) -> Set<String> {
    guard let flow else { return [] }
    var keys = Set<String>()
    for page in flow.pages {
      forEachRow(in: page) { row in
        for action in row.actions {
          for branch in [action.`true`, action.`false`] {
            var unwrapped = branch.trimmingCharacters(in: .whitespacesAndNewlines)
            if unwrapped.hasPrefix("{"), unwrapped.hasSuffix("}") {
              unwrapped = String(unwrapped.dropFirst().dropLast())
            }
            if let (name, args) = parseFunctionCall(unwrapped),
              name == "create"
            {
              let key = args.trimmingCharacters(in: .whitespacesAndNewlines)
              if !key.isEmpty { keys.insert(key) }
            }
          }
        }
      }
    }
    return keys
  }
}

#Preview {
  ContentView()
}
