//
//  ContentView.swift
//  frodo
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct EVYRowData {
  let id: String
  let images: [String]
}

struct ContentView: View {
    let rows = [
        EVYRowData(id: "first", images: ["printer_logo","printer"]),
        EVYRowData(id: "second", images: ["printer"])
    ]
    
    var body: some View {
        List(rows, id: \.id) { row in
            EVYCarousel(imageNames: row.images)
                .frame(height: 250)
                .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
        }
        .frame( maxWidth: .infinity)
        .listStyle(PlainListStyle())
    }
}

#Preview {
    ContentView()
}
