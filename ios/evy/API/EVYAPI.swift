//
//  EVYAPI.swift
//  evy
//
//  Created by Geoffroy Lesage on 7/4/2024.
//

import Foundation

struct ResultResponse: Decodable {
    let results: [Result]
    
    private enum CodingKeys: String, CodingKey {
        case results = "Search"
    }
}

struct Result: Decodable {
    let id: String
    let title: String
    
    private enum CodingKeys: String, CodingKey {
        case id = "imdbID"
        case title = "Title"
    }
    
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        
        let title = try container.decode(String.self, forKey: .title)
        let components = title.components(separatedBy: " ")
        self.title = components.randomElement()!
    }
}

struct ResultViewModel {
    let result: Result
    
    var id: String {
        result.id
    }
    var title: String {
        result.title
    }
}

@MainActor
class EVYSearchAPI: ObservableObject {
    
    @Published var results: [ResultViewModel] = []
    @Published var selected: [ResultViewModel] = []
    
    func search(name: String) async {
        do {
            let results = try await EVYMovieAPI().getResults(searchTerm: name)
            self.results = results.map(ResultViewModel.init)
            
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

enum NetworkError: Error {
    case badURL
    case badID
}

class EVYMovieAPI {
    func getResults(searchTerm: String) async throws -> [Result] {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "omdbapi.com"
        components.queryItems = [
            URLQueryItem(name: "s", value: searchTerm.trimmingCharacters(in: .whitespacesAndNewlines)),
            URLQueryItem(name: "apikey", value: "306232b0")
        ]
        
        guard let url = components.url else {
            throw NetworkError.badURL
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw NetworkError.badID
        }
        
        let resultResponse = try? JSONDecoder().decode(ResultResponse.self, from: data)
        return resultResponse?.results ?? []
    }
}
