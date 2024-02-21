//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct ContentView: View {
    @State private var pages: [EVYPage]
    
    init() {
        let json = SDUIConstants.pages.data(using: .utf8)!

        let data = EVYData.shared
        let item = DataConstants.item.data(using: .utf8)!
        try! data.set(name: "item", data: item)
        
        self.pages = try! JSONDecoder().decode([EVYPage].self, from: json)
    }
    
    var body: some View {
        pages[0]
    }
}

#Preview {
    return ContentView()
}
