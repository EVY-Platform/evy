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
                ForEach(searchController.selected, id: \.id) { result in
                    EVYRectangle(value: result.value, style: .primary, width: .fit)
                        .onTapGesture { searchController.unselect(result) }
                }
            }
        })
        .scrollIndicators(.hidden)
    }
}

#Preview {
    @ObservedObject var searchController = EVYSearchController(source: .remote)
    return EVYSearch(searchController: searchController, placeholder: "Search")
}
