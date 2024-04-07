//
//  EVYHome.swift
//  evy
//
//  Created by Geoffroy Lesage on 26/3/2024.
//

import SwiftUI

struct EVYHome: View {
    @Environment(\.navigate) private var navigate
    
    var body: some View {
        VStack(spacing: 40) {
            Button("View Item") {
                navigate(NavOperation.navigate(Route(flowId: "view_item", pageId: "view")))
            }
            Button("Create Item") {
                navigate(NavOperation.navigate(Route(flowId: "create_item", pageId: "step_1")))
            }
        }
    }
}

#Preview {
    EVYHome()
}
