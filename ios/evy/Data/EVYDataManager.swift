//
//  EVYJson.swift
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
    
    func get(key: String) -> EVYData? {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
        do {
            return try context.fetch(descriptor).first
        } catch {
            return nil
        }
    }
    
    public func create(key: String, data: Data) throws -> Void {
        if get(key: key) != nil {
            throw EVYDataError.keyAlreadyExists
        }
        context.insert(EVYData(key: key, data: data))
    }
    
    public func update(key: String, data: Data) throws -> Void {
        if let existing = get(key: key) {
            existing.data = data
        } else {
            throw EVYDataError.keyNotFound
        }
    }
    
    public func delete(key: String) throws -> Void {
        if let existing = get(key: key) {
            context.delete(existing)
        } else {
            throw EVYDataError.keyNotFound
        }
    }
}

