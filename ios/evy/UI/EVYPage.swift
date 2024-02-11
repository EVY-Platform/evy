//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum PageCodingKeys: String, CodingKey {
    case id = "id"
    case title = "name"
    case flow_id = "flow_id"
    case rows = "rows"
}

struct EVYPage: View, Decodable {
    public var id: String
    public var title: String
    public var flow_id: String
    public var rows: [EVYRow]

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: PageCodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.title = try container.decode(String.self, forKey: .title)
        self.flow_id = try container.decode(String.self, forKey: .flow_id)
        self.rows = try container.decode([EVYRow].self, forKey: .rows)
    }
    
    var body: some View {
        List(rows.indices, id: \.self) { index in
            rows[index]
                .padding(.bottom, Constants.majorPadding)
                .listRowSeparator(.hidden)
        }
        .listStyle(PlainListStyle())
        .ignoresSafeArea()
    }
}

#Preview {
    let json =  DataConstants.page.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYPage.self, from: json)
}
