//
//  EVYRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

public enum CodingKeys: String, CodingKey {
    case type = "type"
    case content = "content"
}

struct EVYRow: View, Decodable {
    public var type: String
    var content: any View

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.type = try container.decode(String.self, forKey: .type)
        
        switch self.type {
        case EVYSelectContainer.JSONType:
            self.content = try EVYSelectContainer(container: container)
            
        default:
            self.content = Spacer()
        }
    }
    
    var body: some View {
        AnyView(content)
    }
}
