//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct ContentView: View {
    @State private var pages = try! JSONDecoder().decode([EVYPage].self, from: json)
    
    var body: some View {
        pages[0]
    }
}

let json = DataConstants.pages.data(using: .utf8)!
#Preview {
    return ContentView()
}
