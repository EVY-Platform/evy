//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct Route: Hashable {
    let flowId: String
    let pageId: String
}

struct NavigateEnvironmentKey: EnvironmentKey {
    static var defaultValue: (Route) -> Void = { _ in }
}

extension EnvironmentValues {
    var navigate: (Route) -> Void {
        get { self[NavigateEnvironmentKey.self] }
        set { self[NavigateEnvironmentKey.self] = newValue }
    }
}

struct ContentView: View {
    private let flows: [EVYFlow]
    @State private var routes: [Route] = []
    
    init() {
        let jsonFlow = SDUIConstants.flows.data(using: .utf8)!
        self.flows = try! JSONDecoder().decode([EVYFlow].self, from: jsonFlow)
    }
    
    private func handleNavigationData(route: Route, flow: EVYFlow?) {
//        if flow.id != route.flowId {
//            // If the old flow was for creation, submit the draft
//            if flow.type == .create {
//                try! EVYDataManager.i.submit(key: flow.data)
//            }
//
//            if route.flowId != "home" {
//                // If the new flow is for creation, start a draft
//                let newFlow = flows.first(where: {$0.id == route.flowId})!
//                if newFlow.type == .create {
//                    let item = DataConstants.item.data(using: .utf8)!
//                    try! EVYDataManager.i.create(key: newFlow.data, data: item)
//                }
//            }
//            // If we are in the same create flow, update the draft
//        } else if flow.type == .create {
//            let item = DataConstants.item.data(using: .utf8)!
//            try! EVYDataManager.i.update(key: flow.data, data: item)
//        }
                                    
        if route.flowId == "home" {
            routes.removeAll()
        }
        else if let existing = routes.lastIndex(of: route) {
            routes.removeSubrange(existing...)
        }
        else {
            routes.append(route)
        }
    }
    
    var body: some View {
        NavigationStack(path: $routes) {
            EVYHome()
                .environment(\.navigate) { route in
                    handleNavigationData(route: route, flow: nil)
                }
                .navigationDestination(for: Route.self) { route in
                    let flow = flows.first(where: {$0.id == route.flowId})!
                    flow.getPageById(route.pageId)!
                        .environment(\.navigate) { route in
                            handleNavigationData(route: route, flow: flow)
                        }
                }
        }
    }
}

#Preview {
    return ContentView()
}
