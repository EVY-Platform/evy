//
//  EVYDataManager.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData

public enum EVYDataError: Error {
    case keyAlreadyExists
    case keyNotFound
}

extension Notification.Name {
    static let evyDataUpdated = Notification.Name("EVYDataUpdated")
}

class EVYState<T>: ObservableObject {
    @Published var value: T
    
    init(watch: String, setter: @escaping (_ input: String) -> T) {
        self.value = setter(watch)
        
        NotificationCenter.default.addObserver(forName: Notification.Name.evyDataUpdated,
                            object: nil,
                            queue: nil,
                            using: { notif in
            if let notifProp = notif.object as? String,
               watch.contains(notifProp)
            {
                self.value = setter(watch)
            }
        })
    }
}

let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try! ModelContainer(for: EVYData.self, configurations: config)

struct EVYDataManager {
    private let context: ModelContext = ModelContext(container)
    
    func exists(key: String) -> Bool {
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
        
        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: key)
    }
    
    func update(key: String, data: Data) throws -> Void {
        let existing = try get(key: key)
        existing.data = data
        
        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: key)
    }
    
    func delete(key: String) throws -> Void {
        let existing = try get(key: key)
        context.delete(existing)
        
        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: key)
    }
}

