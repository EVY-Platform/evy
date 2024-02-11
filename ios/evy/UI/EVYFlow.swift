//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum FlowCodingKeys: String, CodingKey {
    case id = "id"
    case name = "name"
    case pages = "pages"
}

struct EVYFlow: View, Decodable {
    public var id: String
    public var name: String
    public var pages: [EVYPage]
    var content: any View

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: FlowCodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.name = try container.decode(String.self, forKey: .name)
        self.pages = try container.decode([EVYPage].self, forKey: .pages)
        
        self.content = pages[0]
    }
    
    var body: some View {
        AnyView(content)
    }
}

#Preview {
    let json = DataConstants.flow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYFlow.self, from: json)
}
