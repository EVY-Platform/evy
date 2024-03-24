//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYPage: View, Decodable {
    let id: String
    let title: String
    let rows: [EVYRow]

    var body: some View {
        ScrollView {
            ForEach(rows) { row in
                row
                    .padding(.horizontal, Constants.majorPadding)
                    .padding(.vertical, Constants.minorPadding)
            }
        }
    }
}

#Preview {
    let json =  SDUIConstants.page.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYPage.self, from: json)
}
