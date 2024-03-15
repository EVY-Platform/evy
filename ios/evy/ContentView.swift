//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import SwiftData

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
        var page = homePage
        if currentFlowId != nil && currentPageId != nil {
            let flow = flows.first(where: {$0.id == currentFlowId})!
            page = flow.getPageById(currentPageId!)
            
//            let flowModel = flow.data
//            let draft = """
//            {
//                id: \(UUID())
//            """
//            let item = "{}".data(using: .utf8)!
//            try! EVYDataFactory.create(item)
        }
        
        return page.onReceive(.navigateEVYPage) { notification in
            let userInfo = notification.userInfo!
            let target = userInfo["target"] as! String
            
            let newFlowId = target.components(separatedBy: ":")[0]
            currentPageId = target.components(separatedBy: ":")[1]

            if newFlowId != currentFlowId {
                // submit or read or start draft
                currentFlowId = newFlowId
            }
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    let _ = try! EVYDataManager.i.create(item)
    
    return ContentView()
}
