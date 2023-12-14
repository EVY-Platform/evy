//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYTitleRow: View {
    public static var JSONType = "Title"
    private struct JSON: Decodable {
        let title: String
        let title_detail: String
        let subtitle_1: String
        let subtitle_2: String
    }
    
    let title: String
    let titleDetail: String
    let subtitle1: String
    let subtitle2: String
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSON.self, forKey:.content)
        self.title = parsedData.title
        self.titleDetail = parsedData.title_detail
        self.subtitle1 = parsedData.subtitle_1
        self.subtitle2 = parsedData.subtitle_2
    }
    
    var body: some View {
        VStack{
            HStack {
                Text(title)
                    .font(.titleFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(titleDetail)
                    .font(.detailFont)
            }
            .padding(.bottom, Constants.textHeadingLinePadding)

            Text(subtitle1)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, Constants.textLinePaddingMin)
            Text(subtitle2)
                .foregroundStyle(.gray)
                .font(.regularFont)
                .frame(maxWidth: .infinity, alignment: .leading)
               
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
    }
}

#Preview {
    let json = """
    {
        "type": "Title",
        "content": {
            "title": "Amazing Fridge",
            "title_detail": "$250",
            "subtitle_1": ":star_doc: 88% - 4 items sold",
            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
