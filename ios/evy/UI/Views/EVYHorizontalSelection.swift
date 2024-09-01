//
//  EVYHorizontalSelection.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYHorizontalSelection: View {
    @ObservedObject var searchController: EVYSearchController
    
    var body: some View {
        ScrollView(.horizontal, content: {
            HStack {
                ForEach(searchController.selected.reversed(), id: \.self) { result in
                    EVYRectangle(value: result.displayValue(), style: .primary, width: .fit)
                        .onTapGesture { searchController.unselect(result) }
                }
            }
            .offset(x: Constants.majorPadding)
        })
        .scrollIndicators(.hidden)
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    @ObservedObject var searchController = EVYSearchController(source: "{api:movies}",
                                                               destination: "{item.tags}")
    return EVYSearch(searchController: searchController, placeholder: "Search")
}
