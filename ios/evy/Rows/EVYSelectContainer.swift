//
//  EVYSegmentedControlRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct Child: Decodable {
    let title: String
    let children: [EVYRow]
}

struct EVYSelectContainer: View {
    public static var JSONType = "SelectContainer"
    private struct JSONData: Decodable {
        let children: [Child]
    }

    let children: [Child]
    @State private var selection = 0

    init(container: KeyedDecodingContainer<CodingKeys>) throws {
        let parsedData = try container.decode(JSONData.self, forKey:.content)
        self.children = parsedData.children
    }

    var body: some View {
        VStack {
            Picker("Choose", selection: $selection) {
                ForEach(0..<children.count, id: \.self) { index in
                    EVYText(children[index].title).tag(index)
                }
            }
            .pickerStyle(.segmented)
            
            ForEach(children[selection].children.indices, id: \.self) { index in
                children[selection].children[index]
            }
        }
    }
}

#Preview {
    let json = """
    {
        "type": "SelectContainer",
        "content": {
            "children": [
                {
                    "title": "Pickup",
                    "children": []
                },
                {
                    "title": "Deliver",
                    "children": []
                }
            ]
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
