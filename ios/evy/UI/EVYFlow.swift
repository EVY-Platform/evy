//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYFlow: Decodable {
    let id: String
    let name: String
    let start_page: String
    let redirect: String
    let pages: [EVYPage]
    
    func getPageById(_ id: String) -> EVYPage {
        pages.first(where: {$0.id == id})!
    }
}

#Preview {
    let json =  SDUIConstants.flow.data(using: .utf8)!
    let flow = try! JSONDecoder().decode(EVYFlow.self, from: json)
    return flow.getPageById("create_item_step_1")
}
