//
//  EVYSearchMultiple.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/9/2024.
//

import SwiftUI

struct EVYSearchMultiple: View {
    @State private var selected: [EVYSearchResult] = []
    @State private var searchFieldValue = ""
    @ObservedObject private var searchController: EVYSearchController
    
    let source: String
    let destination: String
    let placeholder: String
    let format: String
    
    init(source: String,
         format: String,
         destination: String,
         placeholder: String)
    {
        self.source = source
        self.format = format
        self.destination = destination
        self.placeholder = placeholder
        
        searchController = EVYSearchController(source: source, format: format)
    }
    
    func refresh() {
        do {
            let existingData = try EVY.getDataFromText(destination)
            guard case let .array(arrayValue) = existingData else {
                return
            }
            
            for value in arrayValue {
                let formattedValue = EVY.formatData(json: value, format: format)
                let alreadySelected = selected.contains { $0.value == formattedValue }
                if !alreadySelected {
                    selected.append(EVYSearchResult(data: value, value: formattedValue))
                }
            }
        } catch {}
    }
    
    func select(_ element: EVYSearchResult) {
        do {
            selected.append(element)
            
            let encoded = try JSONEncoder().encode(selected.map { $0.data })
            try EVY.updateData(encoded, at: destination)
            searchController.results.removeAll { $0.value == element.value }
        } catch {
            selected.removeAll { $0.value == element.value }
        }
    }
    
    func unselect(_ element: EVYSearchResult) {
        do {
            selected.removeAll { $0.value == element.value }
            try EVY.updateData(try JSONEncoder().encode(selected.map { $0.data }),
                               at: destination)
        } catch {
            searchController.results.removeAll { $0.value == element.value }
        }
    }
    
    var body: some View {
        VStack {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .padding(.leading, Constants.minorPadding)
                TextField(placeholder, text: $searchFieldValue).font(.evy)
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
            .onChange(of: searchFieldValue) { _, newValue in
                Task(operation: {
                    if !newValue.isEmpty &&  newValue.count > 3 {
                        await searchController.search(name: newValue)
                    } else {
                        searchController.results.removeAll()
                    }
                })
            }
            
            // Search selection
            if selected.count > 0 {
                ScrollView(.horizontal, content: {
                    HStack {
                        ForEach(selected.reversed(), id: \.value) { result in
                            EVYRectangle.fitWidth(content: EVYTextView(result.value),
                                                  style: .primary)
                                .onTapGesture { unselect(result) }
                        }
                    }
                    .offset(x: Constants.majorPadding)
                })
                .scrollIndicators(.hidden)
            }
            
            // Search results
            List {
                ForEach(searchController.results, id: \.value) { result in
                    EVYTextView(result.value)
                        .onTapGesture { select(result) }
                }
                .onChange(of: searchController.results) { _, _ in
                    searchController.results.removeAll { r in
                        return selected.contains { $0.value == r.value }
                    }
                }
            }
            .listStyle(.plain)
            .listRowSpacing(20)
        }
        .onAppear { refresh() }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    return EVYSearch(source: "{api:tags}",
                     destination: "{item.tags}",
                     placeholder: "Search",
                     format: "{$0.value}")
}
