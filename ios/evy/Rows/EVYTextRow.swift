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
            EVYText(view.content.title)
                .font(.titleFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
            EVYText(view.content.text)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
                .lineLimit(expanded ? nil : Int(view.max_lines) ?? 2)
            EVYText(self.expanded ? "Read less" : "Read more")
                .foregroundStyle(Constants.textButtonColor)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onTapGesture {
            self.expanded.toggle()
        }
    }
}



#Preview {
    let json =  DataConstants.textRow.data(using: .utf8)!
    return try? JSONDecoder().decode(EVYRow.self, from: json)
}
