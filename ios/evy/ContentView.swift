//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct ContentView: View {
    @State private var rows = try! JSONDecoder().decode([EVYRow].self, from: json)
    
    var body: some View {
        List(rows.indices, id: \.self) { index in
            rows[index]
                .padding(.bottom, Constants.majorPadding)
                .listRowSeparator(.hidden)
        }
        .listStyle(PlainListStyle())
        .ignoresSafeArea()
    }
}

let json = """
[
    {
        "type": "SegmentedControl",
        "content": {
            "children": [
                {
                    "title": "Pickup",
                    "children": [{
                        "type": "TimeslotPicker",
                        "content": {}
                    }]
                },
                {
                    "title": "Deliver",
                    "children": [{
                        "type": "TimeslotPicker",
                        "content": {}
                    }]
                }
            ]
        }
    }
]
""".data(using: .utf8)!

#Preview {
    return ContentView()
}
