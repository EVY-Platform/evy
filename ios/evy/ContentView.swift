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
    @State private var flows: [SDUI_Flow] = []
    @State private var routes: [Route] = []
    @State private var currentFlowId: String = HOME_FLOW_ID
	@State private var showingAlert = false
	@State private var alertMessage = ""
	@State private var loading = true
	@State private var itemData: Data? // Temporary to avoid making navigation async
    @State private var activeDraftKeys: Set<String> = []
    
    private func showError(_ error: Error) {
        alertMessage = error.localizedDescription
        showingAlert = true
    }
    
    private func handleNavigationData(_ navOperation: NavOperation, _ currentFlowId: String) {
        switch navOperation {
        case .navigate(let route):
            // If the new flow is already in the hierarchy of navigation
            // go back to it instead of adding more to the stack
            if let existing = routes.lastIndex(of: route) {
                routes.removeSubrange(existing...)
			} else {
				routes.append(route)
			}
            
            if currentFlowId == route.flowId {
                break
            }
            
            guard let newFlow = flows.first(where: { $0.id == route.flowId }) else {
                alertMessage = "Flow not found - please check API connection"
                showingAlert = true
                routes.removeLast()
                break
            }
            
            let createKeys = Self.extractCreateKeys(from: newFlow)
            for key in createKeys {
                guard let itemData = itemData else {
                    alertMessage = "Item data not loaded"
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
            try EVY.create(key: key)
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
                        alertMessage = error.localizedDescription
                        showingAlert = true
                        loading = false
                    } catch {
                        alertMessage = error.localizedDescription
                        showingAlert = true
                        loading = false
                    }
                }
                .navigationDestination(for: Route.self) { route in
                    if let flow = flows.first(where: { $0.id == route.flowId }),
                       let page = flow.getPageById(route.pageId) {
                        page
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
			Alert(title: Text("Error"),
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
                    EVY.data.deleteAllDrafts()
                    for key in keysToDelete {
                        do {
                            try EVY.data.delete(key: key)
                        } catch EVYDataError.keyNotFound {
                            // Already cleaned up
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
            guard let updatedFlow = notification.object as? SDUI_Flow else { return }

            if let index = flows.firstIndex(where: { $0.id == updatedFlow.id }) {
                flows[index] = updatedFlow
            } else {
                flows.append(updatedFlow)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .evyErrorOccurred)) { notification in
            if let error = notification.object as? Error {
                showError(error)
            }
        }
    }
    
    static func createKeysToDelete(
        whenLeaving flowId: String,
        flows: [SDUI_Flow],
        activeDraftKeys: Set<String>
    ) -> Set<String> {
        guard let flow = flows.first(where: { $0.id == flowId }) else {
            return []
        }
        return extractCreateKeys(from: flow).intersection(activeDraftKeys)
    }
    
    private static func extractCreateKeys(from flow: SDUI_Flow) -> Set<String> {
        var keys = Set<String>()
        for page in flow.pages {
            for row in page.rows {
                Self.collectCreateKeys(from: row, into: &keys)
            }
            if let footer = page.footer {
                Self.collectCreateKeys(from: footer, into: &keys)
            }
        }
        return keys
    }
    
    private static func collectCreateKeys(from row: SDUI_Row, into keys: inout Set<String>) {
        for action in row.actions {
            for branch in [action.`true`, action.`false`] {
                var unwrapped = branch.trimmingCharacters(in: .whitespacesAndNewlines)
                if unwrapped.hasPrefix("{"), unwrapped.hasSuffix("}") {
                    unwrapped = String(unwrapped.dropFirst().dropLast())
                }
                if let (name, args) = EVYInterpreter.parseFunctionCall(unwrapped),
                   name == "create"
                {
                    let key = args.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !key.isEmpty { keys.insert(key) }
                }
            }
        }
        if let children = row.view.content.children {
            for child in children {
                Self.collectCreateKeys(from: child, into: &keys)
            }
        }
        if let child = row.view.content.child {
            Self.collectCreateKeys(from: child, into: &keys)
        }
    }
}

#Preview {
    ContentView()
}
