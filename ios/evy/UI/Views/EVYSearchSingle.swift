//
//  EVYSearchSingle.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/9/2024.
//

import SwiftUI

struct EVYSearchSingle: View {
    @State private var selected: String = ""
    @State private var value: String = ""
    
    @ObservedObject var searchController: EVYSearchController
    let destination: String
    let placeholder: String
    
    func select(_ element: EVYSearchResult) {
        do {
            value = element.value
            selected = element.value
            let encoded = try JSONEncoder().encode(element.data)
            try EVY.updateData(encoded, at: destination)
        } catch {}
    }
    
    func unselect() {
        do {
            value = ""
            selected = ""
            try EVY.updateValue("{}", at: destination)
        } catch {}
    }
    
    var body: some View {
        VStack {
            // Search bar
            HStack {
                if value.isEmpty {
                    Image(systemName: "magnifyingglass")
                        .padding(.leading, Constants.minorPadding)
                }
                
                TextField(placeholder, text: $value)
                    .font(.evy)
            
                if !value.isEmpty {
                    Image(systemName: "xmark")
                        .padding(.trailing, Constants.minorPadding)
                        .onTapGesture { unselect() }
                }
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
            .padding(.horizontal, Constants.majorPadding)
            .onChange(of: value) { oldValue, newValue in
                Task.init(operation: {
                    if newValue.isEmpty {
                        return
                    }
                    if newValue.count < 3 {
                        return
                    }
                    if newValue == selected {
                        return
                    }
                    
                    await searchController.search(name: newValue)
                })
            }
            
            // Search results
            List {
                ForEach(searchController.results, id: \.value) { result in
                    EVYTextView(result.value).onTapGesture { select(result) }
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
    
    return EVYSearch(source: "{local:address}",
                     destination: "{item.address}",
                     placeholder: "Search",
                     resultKey: "address",
                     resultFormat: "{address.unit} {address.street}, {address.city} {address.state} {address.postcode}")
}
