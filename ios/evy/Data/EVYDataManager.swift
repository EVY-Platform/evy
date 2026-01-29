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

public enum EVYError: LocalizedError {
    case parsingFailed(context: String)
    case invalidData(context: String)
    case regexCompilationFailed(pattern: String)
    case imageLoadFailed(name: String)
    case formatFailed(type: String, reason: String)
    case websocketError(context: String)
    
    public var errorDescription: String? {
        switch self {
        case .parsingFailed(let context):
            return "Parsing failed: \(context)"
        case .invalidData(let context):
            return "Invalid data: \(context)"
        case .regexCompilationFailed(let pattern):
            return "Invalid regex pattern: \(pattern)"
        case .imageLoadFailed(let name):
            return "Failed to load image: \(name)"
        case .formatFailed(let type, let reason):
            return "Failed to format \(type): \(reason)"
        case .websocketError(let context):
            return "WebSocket error: \(context)"
        }
    }
}

extension Notification.Name {
    static let evyDataUpdated = Notification.Name("EVYDataUpdated")
    static let evyFlowUpdated = Notification.Name("EVYFlowUpdated")
    static let evyErrorOccurred = Notification.Name("EVYErrorOccurred")
}

@MainActor
@Observable class EVYState<T> {
    var value: T
	
	init(setter: @escaping () -> T) {
		value = setter()
		
		NotificationCenter.default.addObserver(forName: Notification.Name.evyDataUpdated,
											   object: nil,
											   queue: .main,
											   using: { [weak self] _ in
			Task { @MainActor in
				self?.value = setter()
			}
		})
	}
    
    init(watch: String, setter: @escaping (_ input: String) -> T) {
        value = setter(watch)
        
        NotificationCenter.default.addObserver(forName: Notification.Name.evyDataUpdated,
                            object: nil,
                            queue: .main,
                            using: { [weak self] notif in
            if let notifProp = notif.object as? String,
               watch.contains(notifProp)
            {
				Task { @MainActor in
					self?.value = setter(watch)
				}
            }
        })
    }
	
	init(staticString: T) {
		value = staticString
	}
}

let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try! ModelContainer(for: EVYData.self, configurations: config)

@MainActor
final class EVYDataManager {
    private let context: ModelContext
    
    init() {
        self.context = ModelContext(container)
    }
    
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
    
    func create(key: String, data: Data) throws {
        if exists(key: key) {
            throw EVYDataError.keyAlreadyExists
        }
        context.insert(EVYData(key: key, data: data))
        
        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: key)
    }
    
    func update(props: [String], data: Data) throws {
        let existing = try get(key: props.first!)
        existing.data = data
        
        var propsForNotification = props
        
        let firstIndexWithANumber = props.firstIndex { $0.isNumber }
        if firstIndexWithANumber != nil {
            propsForNotification.removeLast(props.count - firstIndexWithANumber!)
        }
        
        let notifKey = propsForNotification.joined(separator: PROP_SEPARATOR)
        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: notifKey)
    }
    
    func delete(key: String) throws {
        let existing = try get(key: key)
        context.delete(existing)
        
        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: key)
    }
}

