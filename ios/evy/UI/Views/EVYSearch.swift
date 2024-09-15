//
//  EVYSearchView.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearch: View {
    @ObservedObject var searchController: EVYSearchController
    private var canSelectMultiple = false
    @State private var selected: [EVYSearchResult] = []
    @State private var searchFieldValue = ""
    
    let source: String
    let destination: String
    let placeholder: String
    let resultKey: String
    let resultFormat: String
    
    init(source: String,
         destination: String,
         placeholder: String,
         resultKey: String,
         resultFormat: String)
    {
        self.source = source
        self.destination = destination
        self.placeholder = placeholder
        self.resultKey = resultKey
        self.resultFormat = resultFormat
        
        do {
            let data = try EVY.getDataFromText(destination)
            if case .array(_) = data {
                self.canSelectMultiple = true
            }
        } catch {}
        
        self.searchController = EVYSearchController(source: source,
                                                    resultKey: resultKey,
                                                    resultFormat: resultFormat)
    }
    
    func refresh() {
        guard canSelectMultiple else {
            return
        }
        
        do {
            let existingData = try EVY.getDataFromText(destination)
            guard case let .array(arrayValue) = existingData else {
                return
            }
            
            for value in arrayValue {
                let formattedValue = EVY.formatData(json: value, format: resultFormat, key: resultKey)
                let alreadySelected = selected.contains { return $0.value == formattedValue }
                if !alreadySelected {
                    selected.append(EVYSearchResult(data: value, value: formattedValue))
                }
            }
        } catch {}
    }
    
    func select(_ element: EVYSearchResult) {
        do {
            if canSelectMultiple {
                selected.append(element)
            } else {
                selected = [element]
            }
            let encoded = try JSONEncoder().encode(selected.map({ $0.data }))
            try EVY.updateData(encoded, at: destination)
            searchController.results.removeAll(where: {
                return $0.value == element.value
            })
        } catch {
            selected.removeAll(where: { $0.value == element.value })
        }
    }
    
    func unselect(_ element: EVYSearchResult) {
        do {
            selected.removeAll(where: { $0.value == element.value })
            try EVY.updateData(try JSONEncoder().encode(selected.map({ $0.data })),
                               at: destination)
        } catch {
            searchController.results.removeAll(where: { $0.value == element.value })
        }
    }
    
    var body: some View {
        VStack {
            // Search bar
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
            .padding(.horizontal, Constants.majorPadding)
            .onChange(of: searchFieldValue) { oldValue, newValue in
                Task.init(operation: {
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
                            EVYRectangle(value: result.value,
                                         style: .primary,
                                         width: .fit)
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
                .onChange(of: searchController.results) { oldValue, newValue in
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
                     resultKey: "tag",
                     resultFormat: "{tag.value}")
}
