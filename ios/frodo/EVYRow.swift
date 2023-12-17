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
        case EVYCarouselRow.JSONType:
            self.content = try EVYCarouselRow(container: container)
            
        case EVYTitleRow.JSONType:
            self.content = try EVYTitleRow(container: container)
            
        case EVYTextRow.JSONType:
            self.content = try EVYTextRow(container: container)
            
        case EVYDetailRow.JSONType:
            self.content = try EVYDetailRow(container: container)
            
        case EVYDisclaimerRow.JSONType:
            self.content = try EVYDisclaimerRow(container: container)
            
        default:
            fatalError("Unknown type of content.")
        }
    }
    
    var body: some View {
        AnyView(content)
    }
}
