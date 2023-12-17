//
//  EVYDetailRow.swift
//  EVY
//
//  Created by Clemence Chalot on 17/12/2023.
//

import SwiftUI

struct EVYDetailRow: View {
    public static var JSONType = "Detail"
    private struct JSONData: Decodable {
        let title: String
        let logo: String
        let subtitle: String
        let detail: String
    }
    
    private let title: String
    private let logo: String
    private let subtitle: String
    private let detail: String
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.title = parsedData.title
        self.logo = parsedData.logo
        self.subtitle = parsedData.subtitle
        self.detail = parsedData.detail
    }
    
    var body: some View {
        HStack{
            Text(logo)
                .padding()
            VStack{
                HStack {
                    Text(title)
                        .font(.detailFont)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(detail)
                        .font(.detailFont)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }            .padding(.bottom, Constants.majorPadding)
                
                Text(subtitle)
                    .foregroundStyle(.gray)
                    .font(.regularFont)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
    }
}


#Preview {
    let json = """
    {
        "type": "Detail",
        "content": {
            "logo": ":alert:",
            "title": "Condition",
            "subtitle": "Like new",
            "detail": ""
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
