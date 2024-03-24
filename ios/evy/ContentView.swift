//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

extension Notification.Name {
    static let navigateEVYPage = Notification.Name("navigateEVYPage")
}

extension View {
    func onReceive(
        _ name: Notification.Name,
        center: NotificationCenter = .default,
        object: AnyObject? = nil,
        perform action: @escaping (Notification) -> Void
    ) -> some View {
        onReceive(
            center.publisher(for: name, object: object),
            perform: action
        )
    }
}

struct ContentView: View {
    private let flows: [EVYFlow]

    @State private var currentFlowId: String
    @State private var page: EVYPage
    
    init() {
        let jsonFlow = SDUIConstants.flows.data(using: .utf8)!
        
        self.flows = try! JSONDecoder().decode([EVYFlow].self, from: jsonFlow)
        
        let homeFlow = flows.first(where: {$0.id == "home"})!
        _currentFlowId = State(initialValue: homeFlow.id)
        _page = State(initialValue: homeFlow.pages.first!)
    }
    
    var body: some View {
        page.onReceive(.navigateEVYPage) { notification in
            let userInfo = notification.userInfo!
            let target = userInfo["target"] as! String
            let components = target.components(separatedBy: ":")
            
            let newFlowId = components[0]
            let newPageId = components[1]
            
            let newFlow = flows.first(where: {$0.id == newFlowId})!
            let currentFlow = flows.first(where: {$0.id == currentFlowId})!
            
            // If the flow is changing
            if newFlowId != currentFlowId {
                
                // Submit the current draft
                if currentFlow.type == .create {
                    try! EVYDataManager.i.submit(key: currentFlow.data)
                }
                
                // Create a new draft
                if newFlow.type == .create {
                    let item = DataConstants.item.data(using: .utf8)!
                    try! EVYDataManager.i.create(key: newFlow.data, data: item)
                }
                
            // Update the existing draft
            } else if currentFlow.type == .create {
                let item = DataConstants.item.data(using: .utf8)!
                try! EVYDataManager.i.update(key: currentFlow.data, data: item)
            }
            
            currentFlowId = newFlowId
            page = newFlow.getPageById(newPageId)
        }
    }
}

#Preview {
    return ContentView()
}
