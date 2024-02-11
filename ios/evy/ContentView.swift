//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct ContentView: View {
    @State private var flows = try! JSONDecoder().decode([EVYFlow].self, from: json)
    
    var body: some View {
        flows[0].ignoresSafeArea()
    }
}

let json = DataConstants.flows.data(using: .utf8)!
#Preview {
    return ContentView()
}
