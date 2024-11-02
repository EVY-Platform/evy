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
    @ObservedObject private var searchController: EVYSearchController
    
    let destination: String
    let placeholder: String
    
    init(source: String,
         format: String,
         destination: String,
         placeholder: String)
    {
        self.destination = destination
        self.placeholder = placeholder
        
        searchController = EVYSearchController(source: source, format: format)
    }
    
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
                    .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth)
                    .opacity(Constants.borderOpacity)
            )
            .contentShape(Rectangle())
            .padding(.horizontal, Constants.majorPadding)
            .onChange(of: value) { _, newValue in
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
                     format: "{$0.unit} {$0.street}, {$0.city} {$0.state} {$0.postcode}")
}
