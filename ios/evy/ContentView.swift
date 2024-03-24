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
    
    @State private var homePage: EVYPage
    @State private var currentFlowId: String?
    @State private var currentPageId: String?
    
    init() {
        let jsonFlow = SDUIConstants.flows.data(using: .utf8)!
        
        self.flows = try! JSONDecoder().decode([EVYFlow].self, from: jsonFlow)
        self.homePage = (flows.first(where: {$0.id == "home"})?.pages.first)!
    }
    
    var body: some View {
        var page: EVYPage
        
        if currentFlowId == nil || currentPageId == nil {
            page = homePage
        } else {
            let flow = flows.first(where: {$0.id == currentFlowId})!
            page = flow.getPageById(currentPageId!)
            
            if flow.type == .create {
                let item = DataConstants.item.data(using: .utf8)!
                try! EVYDataManager.i.create(item)
            }
        }
        
        return page.onReceive(.navigateEVYPage) { notification in
            let userInfo = notification.userInfo!
            let target = userInfo["target"] as! String
            let components = target.components(separatedBy: ":")
            
            if target.components(separatedBy: ":")[0] == "submit" {
                currentFlowId = components[1]
                currentPageId = components[2]
            }
            else {
                currentFlowId = components[0]
                currentPageId = components[1]
            }
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVYDataManager.i.create(item)
    
    return ContentView()
}
