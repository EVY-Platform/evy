//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public struct Route: Hashable, Codable {
    let flowId: String
    let pageId: String
}
public enum NavOperation: Hashable {
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

private let HOME_FLOW_ID = "f267c629-2594-4770-8cec-d5324ebb4058"

struct ContentView: View {
    @State private var flows: [UI_Flow] = []
    @State private var routes: [Route] = []
    @State private var currentFlowId: String = HOME_FLOW_ID
	@State private var showingAlert = false
	@State private var alertTitle = ""
	@State private var alertMessage = ""
	@State private var loading = true
    @State private var itemData: Data?
    @State private var activeDraftKeys: Set<String> = []
    
    private func showError(_ error: Error) {
		alertTitle = "Error"
        alertMessage = error.localizedDescription
        showingAlert = true
    }
    
    private func handleNavigationData(_ navOperation: NavOperation, _ currentFlowId: String) {
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
            
            guard let newFlow = flows.first(where: { $0.id == route.flowId }) else {
				alertTitle = "Unable to load flow"
                alertMessage = "Please check your internet connection"
                showingAlert = true
                routes.removeLast()
                break
            }
            
            let createKeys = Self.extractCreateKeys(from: newFlow)
            for key in createKeys {
                guard let itemData = itemData else {
					alertTitle = "Unable to load item"
                    alertMessage = "Please check your internet connection"
                    showingAlert = true
                    routes.removeLast()
                    break
                }
                do {
                    try EVY.data.create(key: key, data: itemData)
                    activeDraftKeys.insert(key)
                } catch EVYDataError.keyAlreadyExists {
                    activeDraftKeys.insert(key)
                } catch {
                    showError(error)
                }
            }
            
        case .create(let key):
            createFlow(currentFlowId: currentFlowId, key: key)

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
    
    private func createFlow(currentFlowId: String, key: String) {
        do {
            let draftScope = EVYDraft.createMergeScopeId(flowId: currentFlowId, entityKey: key)
            try EVY.create(key: key, draftScopeId: draftScope)
        } catch {
            showError(error)
            return
        }

        activeDraftKeys.remove(key)

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
                .accessibilityIdentifier("loadingIndicator")
        } else if let homeFlow = flows.first(where: { $0.id == HOME_FLOW_ID }) {
            if homeFlow.pages.isEmpty {
                VStack(spacing: 20) {
                    Text("This flow has no pages")
                        .font(.evyTitle)
                        .foregroundColor(.gray)
                        .accessibilityIdentifier("emptyFlowMessage")
                }
            } else if let homePage = homeFlow.pages.first {
                homePage
                    .environment(\.navigate) { navOperation in
                        handleNavigationData(navOperation, currentFlowId)
                    }
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
                    if !flows.isEmpty { return }
                    
                    do {
                        try EVY.getUserData()
                        itemData = try await EVY.getData()
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
                       let page = flow.getPageById(route.pageId) {
                        page
                            .environment(\.evyDraftScopeId, Self.draftScopeId(for: route, flows: flows))
                            .environment(\.navigate) { navOperation in
                                handleNavigationData(navOperation, currentFlowId)
                            }
                    } else {
                        Text("Flow not found")
                            .foregroundColor(.red)
                    }
                }
        }
		.alert(isPresented: $showingAlert) {
			Alert(title: Text(alertTitle),
				  message: Text(alertMessage),
				  dismissButton: .default(Text("Ok")))
		}
        .onChange(of: routes) { _, _ in
            let previousFlowId = currentFlowId
            let newFlowId = routes.last?.flowId ?? HOME_FLOW_ID
            
            if newFlowId != previousFlowId {
                let keysToDelete = Self.createKeysToDelete(
                    whenLeaving: previousFlowId,
                    flows: flows,
                    activeDraftKeys: activeDraftKeys
                )
                if !keysToDelete.isEmpty {
                    for key in keysToDelete {
                        EVY.data.deleteDrafts(
                            scopeId: EVYDraft.createMergeScopeId(
                                flowId: previousFlowId,
                                entityKey: key
                            )
                        )
                    }
                    for key in keysToDelete {
                        do {
                            try EVY.data.delete(key: key)
                        } catch EVYDataError.keyNotFound {
                        } catch {
                            showError(error)
                        }
                    }
                    activeDraftKeys.subtract(keysToDelete)
                }
            }
            
            currentFlowId = newFlowId
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
    
    static func draftScopeId(for route: Route, flows: [UI_Flow]) -> String? {
        guard let flow = flows.first(where: { $0.id == route.flowId }) else { return nil }
        let keys = extractCreateKeys(from: flow)
        if let k = keys.sorted().first {
            return EVYDraft.createMergeScopeId(flowId: route.flowId, entityKey: k)
        }
        return "\(route.flowId)#browse"
    }

    static func createKeysToDelete(
        whenLeaving flowId: String,
        flows: [UI_Flow],
        activeDraftKeys: Set<String>
    ) -> Set<String> {
        guard let flow = flows.first(where: { $0.id == flowId }) else {
            return []
        }
        return extractCreateKeys(from: flow).intersection(activeDraftKeys)
    }
    
    private static func extractCreateKeys(from flow: UI_Flow) -> Set<String> {
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
