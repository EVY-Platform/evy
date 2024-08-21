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
                    .font(.evy)
            }
            .padding(EdgeInsets(top: Constants.fieldPadding,
                                leading: Constants.minorPadding,
                                bottom: Constants.fieldPadding,
                                trailing: Constants.minorPadding))
            .background(
                RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                    .strokeBorder(Constants.fieldBorderColor, lineWidth: Constants.borderWidth)
                    .opacity(Constants.fieldBorderOpacity)
            )
            .contentShape(Rectangle())
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

#Preview {
    @ObservedObject var searchController = EVYSearchAPI()
    return EVYSearchBar(searchController: searchController, placeholder: "Search")
}
