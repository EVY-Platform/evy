//
//  EVYRow.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI
import Foundation

enum Content {
    case carousel(EVYCarouselRowContent)
    case title(EVYTitleRowContent)
    case contentShort(EVYContentShortRowContent)
}
struct EVYRowData: Decodable {
    var id: String = UUID().uuidString
    var type: String
    var content: Content
}
extension EVYRowData {
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

struct EVYRow: View {
    var id: String = UUID().uuidString
    let rowData: EVYRowData
    
    var body: some View {
        switch rowData.content {
        case .carousel(let carousel):
            EVYCarouselRow(imageNames: carousel.photo_ids)
                .frame(height: 250)
                .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        case .title(let title):
            EVYTitleRow(title: title.title,
                        titleDetail: title.title_detail,
                        subtitle1: title.subtitle_1,
                        subtitle2: title.subtitle_2)
        case .contentShort(let contentShort):
            EVYContentShortRow(title: contentShort.title,
                               content: contentShort.content)
        default:
            fatalError("Unknown type of content.")
        }
    }
}
