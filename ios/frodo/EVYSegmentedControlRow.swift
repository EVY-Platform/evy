//
//  EVYSegmentedControlRow.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct Child: Decodable {
    let title: String
    let children: [EVYRow]
}

struct EVYSegmentedControlRow: View {
    public static var JSONType = "SegmentedControl"
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
        "type": "SegmentedControl",
        "content": {
            "children": [
                {
                    "title": "Pickup",
                    "children": [{
                        "type": "Title",
                        "content": {
                            "title": "1",
                            "title_detail": "$250",
                            "subtitle_1": "::star.square.on.square.fill:: 88% - 4 items sold",
                            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
                        }
                    },{
                        "type": "Title",
                        "content": {
                            "title": "2",
                            "title_detail": "$250",
                            "subtitle_1": "::star.square.on.square.fill:: 88% - 4 items sold",
                            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
                        }
                    }]
                },
                {
                    "title": "Deliver",
                    "children": [{
                        "type": "Title",
                        "content": {
                            "title": "3",
                            "title_detail": "$250",
                            "subtitle_1": "::star.square.on.square.fill:: 88% - 4 items sold",
                            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
                        }
                    }]
                }
            ]
        }
    }
    """.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
