//
//  EVYAPI.swift
//  evy
//
//  Created by Geoffroy Lesage on 7/4/2024.
//

import Foundation

struct APIResponse: Decodable {
    let results: [Result]
    
    private enum CodingKeys: String, CodingKey {
        case results = "Search"
    }
}

struct Result: Decodable, Encodable {
    let id: String
    let value: String
    
    private enum DecodingKeys: String, CodingKey {
        case id = "imdbID"
        case value = "Title"
    }
    
    private enum EncodingKeys: String, CodingKey {
        case id = "id"
        case value = "value"
    }
    
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: DecodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        
        let value = try container.decode(String.self, forKey: .value)
        let components = value.components(separatedBy: " ")
        self.value = components.randomElement()!
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: EncodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(value, forKey: .value)
    }
}

enum NetworkError: Error {
    case badURL
    case badID
}

class EVYMovieAPI {
    func search(term: String) async throws -> Data {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "omdbapi.com"
        components.queryItems = [
            URLQueryItem(name: "s", value: term.trimmingCharacters(in: .whitespacesAndNewlines)),
            URLQueryItem(name: "apikey", value: "306232b0")
        ]
        
        guard let url = components.url else {
            throw NetworkError.badURL
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw NetworkError.badID
        }
        
        let decodedResponse = try? JSONDecoder().decode(APIResponse.self, from: data)
        return try JSONEncoder().encode(decodedResponse?.results ?? [])
    }
}
