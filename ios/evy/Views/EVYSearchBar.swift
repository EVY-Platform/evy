//
//  EVYSearchBar.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearchBar: View {
    @ObservedObject var searchController: EVYSearchAPI
    @State var searchFieldValue = ""
    let placeholder: String
    
    var body: some View {
        HStack {
            HStack {
                Image(systemName: "magnifyingglass")
                TextField(placeholder, text: $searchFieldValue)
            }
            .padding(7)
            .background(Color(.systemFill))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .onChange(of: searchFieldValue) { oldValue, newValue in
            Task.init(operation: {
                if !newValue.isEmpty &&  newValue.count > 3 {
                    await searchController.search(name: newValue)
                } else {
                    searchController.results.removeAll()
                }
            })
        }
    }
}
