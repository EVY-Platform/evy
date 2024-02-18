//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYPage: View, Decodable {
    let id: String
    let flow_id: String
    let name: String
    let rows: [EVYRow]
    
    var body: some View {
        List(rows.indices, id: \.self) { index in
            rows[index].listRowSeparator(.hidden)
        }
        .listStyle(PlainListStyle())
        .ignoresSafeArea()
    }
}

#Preview {
    let json =  SDUIConstants.page.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYPage.self, from: json)
}
