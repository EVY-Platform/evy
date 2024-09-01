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
                .padding(.horizontal, Constants.majorPadding)
            if searchController.selected.count > 0 {
                EVYHorizontalSelection(searchController: searchController)
            }
            List {
                ForEach(searchController.results, id: \.self) { result in
                    EVYTextView(result.displayValue()).onTapGesture {
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
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    @ObservedObject var searchController = EVYSearchController(source: "{api:movies}",
                                                               destination: "{item.tags}")
    return EVYSearch(searchController: searchController, placeholder: "Search")
}
