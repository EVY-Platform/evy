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
  case create(namespace: String, resource: String)
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

// MARK: - Loading Placeholder

/// Mirrors `LaunchScreen.storyboard` so the transition between launch screen
/// and the first SwiftUI frame is seamless — same logo, same position, no spinner.
private struct LaunchPlaceholderView: View {
  var body: some View {
    Color.white
      .ignoresSafeArea()
      .overlay(
        Image("logo")
          .resizable()
          .scaledToFit()
          .frame(width: 240)
          .offset(y: -35)
      )
  }
}

// MARK: - ContentView

struct ContentView: View {
  @State private var homeReloadID = 0
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

  private func reloadHomePage() {
    homeReloadID += 1
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

      guard EVYFlowStore.flowExists(id: route.flowId) else {
        alertTitle = "Unable to load flow"
        alertMessage = "Please check your internet connection"
        showingAlert = true
        routes.removeLast()
        break
      }

    case .create(let namespace, let resource):
      createFlow(namespace: namespace, resource: resource)

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

  private func createFlow(namespace: String, resource: String) {
    do {
      let draftScope = EVYDraft.createMergeScopeId(flowId: currentFlowId, entityKey: resource)
      try EVY.create(namespace: namespace, resource: resource, draftScopeId: draftScope)
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
      LaunchPlaceholderView()
    } else if let firstPageId = EVYFlowStore.firstPageId(inFlowId: HOME_FLOW_ID) {
      EVYPage(pageId: firstPageId)
        .environment(\.navigate) { navOperation in
          handleNavigationData(navOperation)
        }
        .id(homeReloadID)
    } else if EVYFlowStore.flowExists(id: HOME_FLOW_ID) {
      VStack(spacing: 20) {
        Text("This flow has no pages")
          .font(.evyTitle)
          .foregroundColor(.gray)
          .accessibilityIdentifier("emptyFlowMessage")
      }
    } else {
      VStack(spacing: 20) {
        Text("Failed to load flows")
          .font(.evyTitle)
          .foregroundColor(.red)
          .accessibilityIdentifier("errorMessage")
        Text("Please check your connection and try again")
          .font(.subheadline)
          .foregroundColor(.gray)
      }
      .accessibilityIdentifier("errorState")
    }
  }

  var body: some View {
    NavigationStack(path: $routes) {
      homeContent
        .task {
          if !loading { return }

          do {
            try await EVY.sync()
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
          if let pageId = EVYFlowStore.pageId(flowId: route.flowId, pageId: route.pageId) {
            let _ = EVY.cacheQueryParams(route.query, forPageId: route.pageId)

            EVYPage(pageId: pageId)
              .environment(
                \.evyDraftScopeId,
                EVYFlowDraftScopeResolver.draftScopeId(for: route)
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

      let createKeys = EVYFlowStore.createKeys(flowId: previousFlowId)
      for key in createKeys {
        EVY.draftStore.deleteDrafts(
          scopeId: EVYDraft.createMergeScopeId(
            flowId: previousFlowId,
            entityKey: key
          )
        )
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: .evyDataChanged)) { notification in
      guard
        let change = notification.userInfo?[EVYDataChange.userInfoKey] as? EVYDataChange,
        change.namespace == EVYNamespace.evy,
        change.resource == EVYCoreResource.flows.rawValue,
        change.id == HOME_FLOW_ID
      else { return }
      reloadHomePage()
    }
    .onReceive(NotificationCenter.default.publisher(for: .evyUserAlertRequested)) { notification in
      if let userAlert = notification.object as? EVYUserAlert {
        alertTitle = userAlert.title
        alertMessage = userAlert.message ?? ""
        showingAlert = true
      }
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
  static func draftScopeId(
    for route: Route,
    from store: EVYDataStore = EVY.publicStore
  ) -> String? {
    let keys = EVYFlowStore.createKeys(flowId: route.flowId, from: store)
    if let k = keys.sorted().first {
      return EVYDraft.createMergeScopeId(flowId: route.flowId, entityKey: k)
    }
    return "\(route.flowId):browse"
  }
}

#Preview {
  ContentView()
}
