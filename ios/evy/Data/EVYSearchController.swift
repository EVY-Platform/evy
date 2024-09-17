//
//  EVYSearchController.swift
//  evy
//
//  Created by Geoffroy Lesage on 22/8/2024.
//

import SwiftUI

private enum EVYSearchSourceType {
    case api
    case local
}

public struct EVYSearchResult: Equatable {
    let data: EVYJson
    let value: String
}

@MainActor
class EVYSearchController: ObservableObject {
    private let sourceType: EVYSearchSourceType
    private let source: String
    private let format: String
    
    @Published var results: [EVYSearchResult] = []
    
    init (source: String, format: String) {
        self.format = format
        
        let sourceProps = EVY.parsePropsFromText(source)
        if sourceProps.hasPrefix("api:") {
            self.sourceType = .api
            self.source = String(source.dropFirst(4))
        } else if sourceProps.hasPrefix("local:") {
            self.sourceType = .local
            self.source = String(source.dropFirst(6))
        } else {
            self.sourceType = .local
            self.source = source
        }
    }
    
    func search(name: String) async {
        switch(sourceType) {
        case .local:
            let address = DataConstants.address2.data(using: .utf8)!
            let id = UUID()
            try! EVY.data.create(key: id.uuidString, data: address)
            let json = try! EVY.getDataFromProps(id.uuidString)
            let jsonFormatted = EVY.formatData(json: json, format: format)
            results = [EVYSearchResult(data: json, value: jsonFormatted)]
        default:
            do {
                let data = try await EVYMovieAPI().search(term: name)
                let response = try JSONDecoder().decode([EVYJson].self, from: data)
                for res in response {
                    let resFormatted = EVY.formatData(json: res, format: format)
                    self.results.append(EVYSearchResult(data: res, value: resFormatted))
                }
            } catch {
                results = []
            }
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)

    return EVYSearch(source: "{api:movies}",
                     destination: "{item.tags}",
                     placeholder: "Search",
                     format: "{$0.value}")
}
