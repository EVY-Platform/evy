//
//  EVYSearchController.swift
//  evy
//
//  Created by Geoffroy Lesage on 22/8/2024.
//

import Foundation
import SwiftUI

@MainActor
class EVYSearchController: ObservableObject {
    @Published var results: [EVYJson] = []
    @Published var selected: [EVYJson] = []
    
    let source: String
    let destination: String
    
    init (source: String, destination: String) {
        self.source = source
        self.destination = destination
    }
    
    func refresh() {
        do {
            let existingData = try EVY.getDataFromText(destination)
            guard case let .array(arrayValue) = existingData else {
                return
            }
            
            for value in arrayValue {
                let alreadySelected = selected.contains {
                    return $0.displayValue() == value.displayValue()
                }
                if !alreadySelected {
                    selected.append(value)
                }
            }
        } catch {}
    }
    
    func search(name: String) async {
        do {
            let data = try await EVYMovieAPI().search(term: name)
            let response = try JSONDecoder().decode([EVYJson].self, from: data)
            
            for res in response {
                let alreadySelected = selected.contains {
                    return $0.displayValue() == res.displayValue()
                }
                let alreadyInWords = results.contains {
                    return $0.displayValue() == res.displayValue()
                }
                if !alreadySelected && !alreadyInWords {
                    results.append(res)
                }
            }
            
        } catch {
            self.results = []
        }
    }
    
    func select(_ element: EVYJson) {
        do {
            selected.append(element)
            let encoded = try JSONEncoder().encode(selected)
            try EVY.updateValues(encoded, at: self.destination)
            results.removeAll(where: { $0.identifierValue() == element.identifierValue() })
        } catch {
            selected.removeAll(where: { $0.identifierValue() == element.identifierValue() })
        }
    }
    
    func unselect(_ element: EVYJson) {
        do {
            try EVY.updateValues(try JSONEncoder().encode(selected), at: self.destination)
            selected.removeAll(where: { $0.identifierValue() == element.identifierValue() })
        } catch {
            results.removeAll(where: { $0.identifierValue() == element.identifierValue() })
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
