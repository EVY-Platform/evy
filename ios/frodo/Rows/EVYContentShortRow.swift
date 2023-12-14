//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYContentShortRow: View {
    public static var JSONType = "ContentShort"
    private struct JSON: Decodable {
        let title: String
        let content: String
    }
    
    let title: String
    let content: String
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSON.self, forKey:.content)
        self.title = parsedData.title
        self.content = parsedData.content
    }
    
    var body: some View {
        VStack{
            VStack {
                Text(title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, Constants.textLinePadding)
                Text(content)
                    .font(.regularFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.bottom, Constants.textLinePaddingMin)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
    }
}

#Preview {
    let json = """
    {
        "type": "ContentShort",
        "content": {
            "title": "Description",
            "content":
                "Great fridge, barely used. I have to get ride of it because there is already a fridge in my new place."
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
