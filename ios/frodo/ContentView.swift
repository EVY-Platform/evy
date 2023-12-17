//
//  ContentView.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

struct ContentView: View {
    let rows: [EVYRow]
    
    var body: some View {
        List(rows.indices, id: \.self) { index in
            if index == 0 {
                rows[index]
                    .frame(height: 250)
                    .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
            } else {
                rows[index]
            }
            
        }
        .listStyle(PlainListStyle())
        .ignoresSafeArea()
    }
}
