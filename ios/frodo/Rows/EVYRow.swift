//
//  EVYRow.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import Foundation

enum Content {
    case carousel(EVYCarouselRowContent)
    case title(EVYTitleRowContent)
    case contentShort(EVYContentShortRowContent)
}
struct EVYRow: Decodable {
    var id: String = UUID().uuidString
    var type: String
    var content: Content
}
extension EVYRow {
    private enum CodingKeys: String, CodingKey {
        case type = "type"
        case content = "content"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        self.type = try container.decode(String.self, forKey: .type)
        switch self.type {
        case "Carousel":
            let carousel = try container.decode(EVYCarouselRowContent.self, forKey:.content)
            self.content = .carousel(carousel)
        case "Title":
            let title = try container.decode(EVYTitleRowContent.self, forKey:.content)
            self.content = .title(title)
        case "ContentShort":
            let title = try container.decode(EVYContentShortRowContent.self, forKey:.content)
            self.content = .contentShort(title)
        default:
            fatalError("Unknown type of content.")
        }
    }
}
