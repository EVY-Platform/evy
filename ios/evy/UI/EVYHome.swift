//
//  EVYHome.swift
//  evy
//
//  Created by Geoffroy Lesage on 26/3/2024.
//

import SwiftUI

struct EVYHome: View {
    @Environment(\.navigate) private var navigate
    
    init() {
        let item = DataConstants.item.data(using: .utf8)!
        try! EVYDataManager.i.create(key: "item", data: item)
    }
    
    var body: some View {
        VStack(spacing: 40) {
            Button("View Item") {
                navigate(Route(flowId: "view_item", pageId: "view"))
            }
            Button("Create Item") {
                navigate(Route(flowId: "create_item", pageId: "step_1"))
            }
        }
    }
}

#Preview {
    EVYHome()
}
