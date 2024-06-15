//
//  EVYDataManager.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData

typealias RegexMatch = Regex<AnyRegexOutput>.Match

public enum EVYDataParseError: Error {
    case invalidProps
    case invalidVariable
}

public enum EVYDataError: Error {
    case keyAlreadyExists
    case keyNotFound
}

let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try! ModelContainer(for: EVYData.self, configurations: config)

struct EVYDataManager {
    private var context: ModelContext = ModelContext(container)
    
    func exists(key: String) -> Bool {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
        do {
            return try context.fetchCount(descriptor) > 0
        } catch {
            return false
        }
    }
    
    func get(key: String) throws -> EVYData? {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
        return try context.fetch(descriptor).first
    }
    
    public func create(key: String, data: Data) throws -> Void {
        if exists(key: key) {
            throw EVYDataError.keyAlreadyExists
        }
        context.insert(EVYData(key: key, data: data))
    }
    
    public func update(key: String, data: Data) throws -> Void {
        if let existing = try get(key: key) {
            existing.data = data
        } else {
            throw EVYDataError.keyNotFound
        }
    }
    
    public func delete(key: String) throws -> Void {
        if let existing = try get(key: key) {
            context.delete(existing)
        } else {
            throw EVYDataError.keyNotFound
        }
    }
}

