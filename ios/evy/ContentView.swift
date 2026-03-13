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
			
			// If the new flow is for creation, start a draft
            if newFlow.type == .create {
                let key: String = newFlow.data
                guard let itemData = itemData else {
                    alertMessage = "Item data not loaded"
                    showingAlert = true
                    routes.removeLast()
                    break
                }
                do {
                    try EVY.data.create(key: key, data: itemData)
                } catch EVYDataError.keyAlreadyExists {
                    // Draft already exists, continue
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
        guard let currentFlow = flows.first(where: { $0.id == currentFlowId }) else {
            alertMessage = "Flow not found"
            showingAlert = true
            return
        }
        if currentFlow.type != .create {
            alertMessage = "Cannot create - not a create flow"
            showingAlert = true
            return
        }

        do {
            try EVY.create(key: key)
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
            let newFlowId = routes.last?.flowId ?? HOME_FLOW_ID
            
            if newFlowId != currentFlowId,
			   let currentFlow = flows.first(where: {
				   $0.id == currentFlowId
			   }),
               currentFlow.type == .create
			{
                EVY.data.deleteAllDrafts()
                do {
                    try EVY.data.delete(key: currentFlow.data)
                } catch EVYDataError.keyNotFound {
                    // Data doesn't exist, continue
                } catch {
                    showError(error)
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
}

#Preview {
    ContentView()
}
