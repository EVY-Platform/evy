//
//  EVYFlow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum EVYFlowType: String, Decodable {
    case create
    case read
    case update
    case delete
}

struct EVYFlow: Decodable {
    let id: String
    let name: String
    let type: EVYFlowType
    let data: String
    let pages: [EVYPage]
    
    func getPageById(_ id: String) -> EVYPage? {
        pages.first(where: {$0.id == id})
    }
}

#Preview {
    let json =  SDUIConstants.viewItemFlow.data(using: .utf8)!
    let flow = try! JSONDecoder().decode(EVYFlow.self, from: json)
    return flow.getPageById("view")
}
