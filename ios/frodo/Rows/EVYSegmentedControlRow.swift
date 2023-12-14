//
//  FImageFullScreen.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct Child {
    let title: String
    let child: EVYTitleRow
}

//struct EVYSegmentedControlRowContent: Decodable {
//    struct ChildContent: Decodable {
//        let title: String
//        let child: EVYTitleRowContent
//    }
//    let children: [ChildContent]
//}
//
//struct EVYSegmentedControlRow: View, Decodable {
//    public static var JSONType = "SegmentedControl"
//    
//    let children: [Child]
//    @State private var selection = 0
//    
//    init(from decoder: Decoder) throws {
//        let container = try decoder.container(keyedBy: CodingKeys.self)
//        let parsedData = try container.decode(Self.self, forKey:.content)
//        self.children = parsedData.children
//    }
//    
//    var body: some View {
//        VStack {
//            Picker("Choose", selection: $selection) {
//                ForEach(0..<children.count, id: \.self) { index in
//                    Text(children[index].title).tag(index)
//                }
//            }
//            .pickerStyle(.segmented)
//            .padding()
//            children[selection].child
//        }
//    }
//}
//
//#Preview {
//    let json = """
//    [
//        {
//            "type": "Title",
//            "content": {
//                "title": "Amazing Fridge",
//                "title_detail": "$250",
//                "subtitle_1": ":star_doc: 88% - 4 items sold",
//                "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
//            }
//        },
//        {
//            "type": "Title",
//            "content": {
//                "title": "Amazing 2",
//                "title_detail": "$250",
//                "subtitle_1": ":star_doc: 88% - 4 items sold",
//                "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
//            }
//        },
//        {
//            "type": "Title",
//            "content": {
//                "title": "Amazing 3",
//                "title_detail": "$250",
//                "subtitle_1": ":star_doc: 88% - 4 items sold",
//                "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
//            }
//        }
//    ]
//    """.data(using: .utf8)!
//    let titleRows = try! JSONDecoder().decode([EVYTitleRow].self, from: json)
//    
//    var children: [Child] = []
//    titleRows.forEach { titleRow in
//        children.append(Child(title: "child1", child: titleRow))
//    }
//    return EVYSegmentedControlRow(children: children)
//    
//    let json = """
//    {
//        "type": "Title",
//        "content": {
//            "title": "Amazing Fridge",
//            "title_detail": "$250",
//            "subtitle_1": ":star_doc: 88% - 4 items sold",
//            "subtitle_2": "Rosebery, NSW  -  Posted on Nov 8th"
//        }
//    }
//    """.data(using: .utf8)!
//    return try! JSONDecoder().decode(EVYTitleRow.self, from: json)
//}
