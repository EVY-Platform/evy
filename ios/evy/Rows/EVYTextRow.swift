//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYTextRowView: Decodable {
    let content: ContentData
    let max_lines: String
    
    struct ContentData: Decodable {
        let title: String
        let text: String
    }
}
    
struct EVYTextRow: View {
    public static var JSONType = "Text"
    
    private let view: EVYTextRowView
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(EVYTextRowView.self, forKey:.view)
    }
    
    @State private var expanded: Bool = false
    var body: some View {
        VStack {
            if (view.content.title.count > 0) {
                EVYTextView(view.content.title)
                    .font(.evy)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            EVYTextView(view.content.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(expanded ? nil : Int(view.max_lines) ?? 2)
            EVYTextView(expanded ? "Read less" : "Read more")
                .foregroundStyle(Constants.textButtonColor)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, Constants.minPading)
        }
        .onTapGesture {
            expanded.toggle()
        }
    }
}



#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    let _ = try! EVYDataManager.i.create(item)
    
    let json =  SDUIConstants.textRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
