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
    private let startPage: EVYPage
    
    @State private var currentFlowId: String?
    @State private var currentPageId: String?
    
    init() {
        let jsonFlow = SDUIConstants.flows.data(using: .utf8)!
        let jsonPage = SDUIConstants.testPage.data(using: .utf8)!

        let data = EVYData.shared
        let item = DataConstants.item.data(using: .utf8)!
        try! data.set(name: "item", data: item)
        
        self.flows = try! JSONDecoder().decode([EVYFlow].self, from: jsonFlow)
        self.startPage = try! JSONDecoder().decode(EVYPage.self, from: jsonPage)
    }
    
    var body: some View {
        var page = startPage
        if currentFlowId != nil && currentPageId != nil {
            let flow = flows.first(where: {$0.id == currentFlowId})!
            page = flow.getPageById(currentPageId!)
        }
        
        return page.onReceive(.navigateEVYPage) { notification in
            let userInfo = notification.userInfo!
            let target = userInfo["target"] as! String
            
            currentFlowId = target.components(separatedBy: ":")[0]
            currentPageId = target.components(separatedBy: ":")[1]
            
            if currentPageId == "submit" {
                let flow = flows.first(where: {$0.id == currentFlowId})!
                currentPageId = flow.start_page
            }
        }
    }
}

#Preview {
    return ContentView()
}
