//
//  EVYRow.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import Foundation

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
            self.content = try EVYCarouselRow(from: decoder)
            
        case EVYTitleRow.JSONType:
            self.content = try EVYTitleRow(from: decoder)
            
        case EVYContentShortRow.JSONType:
            self.content = try EVYContentShortRow(from: decoder)
            
        default:
            fatalError("Unknown type of content.")
        }
    }
    
    var body: some View {
        AnyView(content)
    }
}
