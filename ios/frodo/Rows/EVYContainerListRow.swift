//
//  EVYDetailRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 21/12/2023.
//

import SwiftUI

struct EVYContainerListRow: View {
    public static var JSONType = "ContainerList"
    private struct JSONData: Decodable {
        let children: [EVYRow]
    }
    
    private let children: [EVYRow]
    
    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.children = parsedData.children
    }
    
    var body: some View {
        VStack {
            ForEach(0..<children.count, id: \.self) { index in
                children[index]
            }
        }.padding(.bottom, Constants.minorPadding)
    }
}


#Preview {
    let json = """
    {
        "type": "ContainerList",
        "content": {
            "children": [{
                "type": "Detail",
                "content": {
                    "icon": "condition",
                    "title": "Condition",
                    "subtitle": "Like new",
                    "detail": ""
                }
            },{
                "type": "Detail",
                "content": {
                    "icon": "reason",
                    "title": "Selling reason",
                    "subtitle": "Moving out",
                    "detail": ""
                }
            }]
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
