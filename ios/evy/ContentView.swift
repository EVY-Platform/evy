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
    private let pages: [EVYPage]
    @State private var selectedPageId: String?
    
    init() {
        let json = SDUIConstants.pages.data(using: .utf8)!

        let data = EVYData.shared
        let item = DataConstants.item.data(using: .utf8)!
        try! data.set(name: "item", data: item)
        
        self.pages = try! JSONDecoder().decode([EVYPage].self, from: json)
        
        _selectedPageId = State(initialValue: pages[0].id)
    }
    
    var body: some View {
        let selectedPageIndex = pages.firstIndex(where: {$0.id == selectedPageId})!
        pages[selectedPageIndex].onReceive(.navigateEVYPage) { notification in
            let userInfo = notification.userInfo!
            let type = userInfo["type"] as! String
            let target = userInfo["target"] as! String
            
            if type == "navigate" {
                selectedPageId = target
            } else if type == "submit" {
                print("submit")
            }
        }
    }
}

#Preview {
    return ContentView()
}
