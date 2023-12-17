//
//  EVYDisclaimerRow.swift
//  EVY
//
//  Created by Clemence Chalot on 17/12/2023.
//

import SwiftUI

struct EVYDisclaimerRow: View {
    public static var JSONType = "Disclaimer"
    private struct JSONData: Decodable {
        let title: String
        let icon: String
        let subtitle: String
    }
    
    private let title: String
    private let icon: String
    private let subtitle: String

    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.title = parsedData.title
        self.icon = parsedData.icon
        self.subtitle = parsedData.subtitle
    }

    var body: some View {
        VStack{
            VStack{
                Text(title)
                    .font(.detailFont)
                    .padding(.bottom, Constants.textLinePadding)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack{
                    Text(icon)
                    Text(subtitle)
                        .foregroundStyle(.gray)
                        .font(.regularFont)
                    //                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxHeight: .none)
            .padding(9)
            .background(Constants.disclaimerBackground)
            .cornerRadius(10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding()
    }
}

#Preview {
    let json = """
    {
        "type": "Disclaimer",
        "content": {
            "icon": ":lock:",
            "title": "EVY Protection",
            "subtitle": "Your money will be held until Australia Post confirms delivery"
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
