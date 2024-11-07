//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum EVYNavigationError: Error {
    case cannotSubmit
}

public struct Route: Hashable, Codable {
    let flowId: String
    let pageId: String
}
public enum NavOperation: Hashable {
    case navigate(Route)
    case submit
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

struct ContentView: View {
    @State private var flows: [EVYFlow] = []
    @State private var routes: [Route] = []
    @State private var currentFlowId: String = "home"
	@State private var showingAlert = false
	@State private var alertMessage = ""
	@State private var loading = true
	@State private var itemData: Data? // Temporary to avoid making navigation async
    
    private func handleNavigationData(_ navOperation: NavOperation, _ currentFlowId: String) throws {
        switch navOperation {
        case .navigate(let route):
            // If the new flow is already in the hierarchy of navigation
            // go back to it instead of adding more to the stack
            if let existing = routes.lastIndex(of: route) {
                routes.removeSubrange(existing...)
			} else {
				let currentFlow = flows.first { $0.id == currentFlowId }
				if !routes.isEmpty {
					let currentPageId = routes.last!.pageId
					let currentPage = currentFlow!.pages.first { $0.id == currentPageId }!
					if currentFlow?.type == .create, !currentPage.complete() {
						alertMessage = currentPage.incompleteMessages().joined(separator: "\n")
						showingAlert = true
						break
					}
				}
				routes.append(route)
			}
            
            if currentFlowId == route.flowId {
                break
            }
            
            // If the new flow is for creation, start a draft
            let newFlow = flows.first { $0.id == route.flowId }!
            if newFlow.type == .create {
                let key: String? = newFlow.data
                try! EVY.data.create(key: key!, data: itemData!)
            }
            
        case .submit:
            // Make sure the flow was for creation, otherwise error out
            let currentFlow: EVYFlow = flows.first { $0.id == currentFlowId }!
            if currentFlow.type != .create {
                throw EVYNavigationError.cannotSubmit
            }
			
			let allPagesComplete = currentFlow.pages.allSatisfy { $0.complete() }
			if !allPagesComplete {
				alertMessage = "Incomplete flow"
				showingAlert = true
				break
			}
			
            // Otherwise, submit the data
            try! EVY.submit(key: currentFlow.data)
            
            // Then, remove the current flow from navigation
			if let existing = routes.firstIndex(where: { route in
				route.flowId == currentFlowId
			}) {
                routes.removeSubrange(existing...)
            } else {
                // But if something is wrong, we exit back home
                routes.removeAll()
            }
            
        case .close:
            // If the flow was for creation, delete the draft
            let currentFlow: EVYFlow? = flows.first { $0.id == currentFlowId }
            if currentFlow?.type == .create {
                let key: String? = currentFlow?.data
                try! EVY.data.delete(key: key!)
            }
            
			if let existing = routes.firstIndex(where: { route in
				route.flowId == currentFlowId
			}) {
                routes.removeSubrange(existing...)
            } else {
                routes.removeAll()
            }
        }
    }
    
    var body: some View {
        NavigationStack(path: $routes) {
			EVYHome(loading: $loading)
				.task {
					do {
						try await EVY.syncData()
						itemData = try await EVY.getItemData()
						flows = try await EVY.getSDUIFlows()
					} catch {
						alertMessage = "Could not load flows"
						showingAlert = true
					}
					loading = false
				}
                .environment(\.navigate) { navOperation in
                    try! handleNavigationData(navOperation, currentFlowId)
                }
                .navigationDestination(for: Route.self) { route in
                    let flow = flows.first { $0.id == route.flowId }!
                    flow.getPageById(route.pageId)!
                        .environment(\.navigate) { navOperation in
                            try! handleNavigationData(navOperation, currentFlowId)
                        }
                }
        }
		.alert(isPresented: $showingAlert) {
			Alert(title: Text("Incomplete form"),
				  message: Text(alertMessage),
				  dismissButton: .default(Text("Ok")))
		}
        .onChange(of: routes) { _, _ in
            let newFlowId = routes.last?.flowId ?? "home"
            
            // To be safe, we remove any existing data if the flow has changed
            if newFlowId != currentFlowId,
			   let currentFlow = flows.first(where: {
				   $0.id == currentFlowId
			   }),
               currentFlow.type == .create
			{
                do {
                    try EVY.data.delete(key: currentFlow.data)
                } catch {}
            }
            
            currentFlowId = newFlowId
        }
    }
}

#Preview {
    ContentView()
}
