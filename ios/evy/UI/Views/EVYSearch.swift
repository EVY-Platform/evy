//
//  EVYSearchView.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearch: View {
    @ObservedObject var searchController: EVYSearchController
    let placeholder: String
    
    var body: some View {
        VStack {
            EVYSearchBar(searchController: searchController, placeholder: placeholder)
            if searchController.selected.count > 0 {
                EVYHorizontalSelection(searchController: searchController).padding()
            }
            List {
                ForEach(searchController.results, id: \.id) { result in
                    EVYTextView(result.value).onTapGesture {
                        searchController.select(result)
                    }
                }
            }
            .listStyle(.plain)
            .listRowSpacing(20)
        }
    }
}

#Preview {
    @ObservedObject var searchController = EVYSearchController(source: .remote)
    return EVYSearch(searchController: searchController, placeholder: "Search")
}
