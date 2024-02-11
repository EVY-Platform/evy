//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYTextRow: View {
    
    public static var JSONType = "Text"
    private struct JSONContentData: Decodable {
        let title: String
        let text: String
    }
    private struct JSONData: Decodable {
        let content: JSONContentData
        let maxLines: String
    }
    
    private let title: String
    private let text: String
    private let maxLines: Int
    
    @State private var expanded: Bool = false
    
    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.view)
        self.title = parsedData.content.title
        self.text = parsedData.content.text
        self.maxLines = Int(parsedData.maxLines) ?? 2
    }
    private var moreLessText: String {
        return self.expanded ? "Read less" : "Read more"
    }
    
    var body: some View {
        VStack {
            EVYText(title)
                .font(.titleFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
            EVYText(text)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
                .lineLimit(expanded ? nil : maxLines)
            EVYText(moreLessText)
                .foregroundStyle(Constants.textButtonColor)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        .onTapGesture {
            self.expanded.toggle()
        }
    }
}



#Preview {
    let json = DataConstants.textRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
