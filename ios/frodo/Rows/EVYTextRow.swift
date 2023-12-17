//
//  EVYTextRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYTextRow: View {
    
    public static var JSONType = "Text"
    private struct JSONData: Decodable {
        let title: String
        let content: String
        let maxLines: String
    }
    
    private let title: String
    private let content: String
    private let maxLines: Int
    
    @State private var expanded: Bool = false
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.title = parsedData.title
        self.content = parsedData.content
        self.maxLines = Int(parsedData.maxLines) ?? 2
    }
    private var moreLessText: String {
        return self.expanded ? "Read less" : "Read more"
    }
    
    var body: some View {
        VStack {
            Text(title)
                .font(.titleFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
            Text(content)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePadding)
                .lineLimit(expanded ? nil : maxLines)
            Text(moreLessText)
                .foregroundStyle(Constants.textButtonColor)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        .onTapGesture {
            self.expanded.toggle()
        }
    }
}



#Preview {
    let json = """
    {
        "type": "Text",
        "content": {
            "title": "Description",
            "content":
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
            "maxLines": "2"
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
