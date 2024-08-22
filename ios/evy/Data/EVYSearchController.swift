//
//  EVYSearchController.swift
//  evy
//
//  Created by Geoffroy Lesage on 22/8/2024.
//

import Foundation

struct ResultViewModel {
    let result: Result
    
    var id: String {
        result.id
    }
    var value: String {
        result.value
    }
}

public enum EVYSearchSource: String {
    case local
    case remote
}

@MainActor
class EVYSearchController: ObservableObject {
    @Published var results: [ResultViewModel] = []
    @Published var selected: [ResultViewModel] = []
    
    let source: EVYSearchSource
    
    init (source: EVYSearchSource) {
        self.source = source
    }
    
    func search(name: String) async {
        do {
            switch source {
            case .local:
                let results = try await EVYMovieAPI().getResults(searchTerm: name)
                self.results = results.map(ResultViewModel.init)
            case .remote:
                let results = try await EVYMovieAPI().getResults(searchTerm: name)
                self.results = results.map(ResultViewModel.init)
            }
        } catch {
            print(error)
        }
    }
    
    func select(_ element: ResultViewModel) {
        selected.append(element)
        results.removeAll(where: { $0.id == element.id })
    }
    
    func unselect(_ element: ResultViewModel) {
        results.insert(element, at: 0)
        selected.removeAll(where: { $0.id == element.id })
    }
}
