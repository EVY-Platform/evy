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
    let value: String
    
    private enum CodingKeys: String, CodingKey {
        case id = "imdbID"
        case value = "Title"
    }
    
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        
        let value = try container.decode(String.self, forKey: .value)
        let components = value.components(separatedBy: " ")
        self.value = components.randomElement()!
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
