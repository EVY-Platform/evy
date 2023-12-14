//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYContentShortRow: View, Decodable {
    public static var JSONType = "ContentShort"
    
    let title: String
    let content: String
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let parsedData = try container.decode(Self.self, forKey:.content)
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
    return try! JSONDecoder().decode(EVYContentShortRow.self, from: json)
}
