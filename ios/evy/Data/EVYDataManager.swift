//
//  EVYDataManager.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData

typealias RegexMatch = Regex<AnyRegexOutput>.Match

public enum EVYDataError: Error {
    case keyAlreadyExists
    case keyNotFound
}

let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try! ModelContainer(for: EVYData.self, configurations: config)

struct EVYDataManager {
    private var context: ModelContext = ModelContext(container)
    
    private func exists(key: String) -> Bool {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
        do {
            return try context.fetchCount(descriptor) > 0
        } catch {
            return false
        }
    }
    
    func get(key: String) throws -> EVYData {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
        guard let first = try context.fetch(descriptor).first else {
            throw EVYDataError.keyNotFound
        }
        return first
    }
    
    func create(key: String, data: Data) throws -> Void {
        if exists(key: key) {
            throw EVYDataError.keyAlreadyExists
        }
        context.insert(EVYData(key: key, data: data))
    }
    
    func update(key: String, data: Data) throws -> Void {
        let existing = try get(key: key)
        existing.data = data
    }
    
    func delete(key: String) throws -> Void {
        let existing = try get(key: key)
        context.delete(existing)
    }
}

