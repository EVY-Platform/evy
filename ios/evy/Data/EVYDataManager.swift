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
    static let i = EVYDataManager()
    
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
    
    public func submit(key: String) throws -> Void {
        if let existing = get(key: key) {
            existing.key = UUID().uuidString
            // TODO: Send to API
        } else {
            throw EVYDataError.keyNotFound
        }
    }
    
    public func updateValue(_ value: String, at: String) throws -> Void {
        guard let (_, props) = EVYTextView.propsFromText(at) else {
            throw EVYDataParseError.invalidProps
        }
            
        let variables = props.components(separatedBy: ".")
        if variables.count > 1 {
            guard let modelData = get(key: variables.first!) else {
                throw EVYDataError.keyNotFound
            }
            do {
                let valueAsData = "\"\(value)\"".data(using: .utf8)!
                let valueAsJson = try! JSONDecoder().decode(EVYJson.self, from: valueAsData)
                let updatedData = try getUpdatedData(props: Array(variables[1...]),
                                                     data: modelData.decoded(),
                                                     value: valueAsJson)
                
                let newData = try JSONEncoder().encode(updatedData)
                try! update(key: variables.first!, data: newData)
            } catch {}
        }
    }
    
    private func getUpdatedData(props: [String], data: EVYJson, value: EVYJson) throws -> EVYJson {
        if props.count < 1 {
            return data
        }
        
        switch data {
        case .dictionary(var dictValue):
            guard let firstVariable = props.first else {
                throw EVYDataParseError.invalidProps
            }
            guard let subData = dictValue[firstVariable] else {
                throw EVYDataParseError.invalidVariable
            }
            if props.count == 1 {
                dictValue[firstVariable] = value
                let dictAsData = try JSONEncoder().encode(dictValue)
                return try JSONDecoder().decode(EVYJson.self, from: dictAsData)
            }
            
            return try getUpdatedData(props: Array(props[1...]), data: subData, value: value)
        default:
            return data
        }
    }
}

