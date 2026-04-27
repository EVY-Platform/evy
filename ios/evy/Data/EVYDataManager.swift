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
@Observable class EVYState<T: Equatable> {
    private var _value: T
    var value: T {
        get { _value }
        set {
            if _value != newValue { _value = newValue }
        }
    }

    init(setter: @escaping () -> T) {
        _value = setter()

        NotificationCenter.default.addObserver(
            forName: .evyDataUpdated,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.value = setter()
            }
        }
    }

    init(watch: String, setter: @escaping (_ input: String) -> T) {
        _value = setter(watch)

        let watchProps = EVY.parsePropsFromText(watch)
        let watchSegments = watchProps.components(separatedBy: PROP_SEPARATOR)

        NotificationCenter.default.addObserver(
            forName: .evyDataUpdated,
            object: nil,
            queue: .main
        ) { [weak self] notif in
            Task { @MainActor in
                guard let notifProp = notif.object as? String else {
                    self?.value = setter(watch)
                    return
                }

                let notifSegments = notifProp.components(separatedBy: PROP_SEPARATOR)
                let minLen = min(watchSegments.count, notifSegments.count)
                let prefixMatch = Array(watchSegments.prefix(minLen)) == Array(notifSegments.prefix(minLen))

                if prefixMatch { self?.value = setter(watch) }
            }
        }
    }

    init(staticString: T) {
        _value = staticString
    }
}

let config = ModelConfiguration(isStoredInMemoryOnly: true)
let container = try! ModelContainer(for: EVYData.self, EVYDraft.self, configurations: config)

@MainActor
final class EVYDataManager {
    private let context: ModelContext

    var activeDraftScopeId: String?

    init() { self.context = ModelContext(container) }

    func exists(key: String) -> Bool {
        (try? get(key: key)) != nil
    }

    func get(key: String) throws -> EVYData {
        let descriptor = FetchDescriptor<EVYData>(predicate: #Predicate { $0.key == key })
        if let first = try context.fetch(descriptor).first {
            return first
        }

        let suffix = ":\(key)"
        let fallbackDescriptor = FetchDescriptor<EVYData>()
        if let first = try context.fetch(fallbackDescriptor).first(where: { $0.key.hasSuffix(suffix) }) {
            return first
        }

        throw EVYDataError.keyNotFound
    }

    func create(key: String, data: Data) throws {
        if exists(key: key) {
            throw EVYDataError.keyAlreadyExists
        }
        context.insert(EVYData(key: key, data: data))

        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: key)
    }

    func upsert(key: String, value: Data) throws {
        let nowIso = Date().ISO8601Format()

        if let existing = try? get(key: key) {
            existing.data = value
            existing.lastSyncedAt = nowIso
        } else {
            context.insert(EVYData(key: key, lastSyncedAt: nowIso, data: value))
        }

        NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                        object: key)

        if let resourceKey = key.split(separator: ":").last.map(String.init),
           resourceKey != key
        {
            NotificationCenter.default.post(name: Notification.Name.evyDataUpdated,
                                            object: resourceKey)
        }
    }

    func update(props: [String], data: Data) throws {
        let existing = try get(key: props.first!)
        existing.data = data

        var propsForNotification = props
        if let index = props.firstIndex(where: { $0.isNumber }) {
            propsForNotification.removeLast(props.count - index)
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

    // MARK: - Drafts

    func drafts(forScopeId scopeId: String) throws -> [EVYDraft] {
        let descriptor = FetchDescriptor<EVYDraft>(predicate: #Predicate { $0.scopeId == scopeId })
        return try context.fetch(descriptor)
    }

    func draft(binding: EVYDraft.Binding) throws -> EVYDraft {
        guard let row = draftFirstMatching(scopeId: binding.scopeId, pathKey: binding.pathKey) else {
            throw EVYDataError.keyNotFound
        }
        return row
    }

    func draftIfPresent(binding: EVYDraft.Binding) -> EVYDraft? {
        draftFirstMatching(scopeId: binding.scopeId, pathKey: binding.pathKey)
    }

    private func draftFirstMatching(scopeId: String, pathKey: String) -> EVYDraft? {
        let sid = scopeId
        let pk = pathKey
        let descriptor = FetchDescriptor<EVYDraft>(
            predicate: #Predicate { $0.scopeId == sid && $0.pathKey == pk }
        )
        do {
            return try context.fetch(descriptor).first
        } catch {
            #if DEBUG
            print("[EVYDataManager] draftFirstMatching error: \(error)")
            #endif
            return nil
        }
    }

    func hasDraft(binding: EVYDraft.Binding) -> Bool {
        draftIfPresent(binding: binding) != nil
    }

    func createDraft(binding: EVYDraft.Binding, data: Data) throws {
        if hasDraft(binding: binding) {
            throw EVYDataError.keyAlreadyExists
        }
        context.insert(EVYDraft(binding: binding, data: data))
        NotificationCenter.default.post(name: .evyDataUpdated, object: binding.notificationKey)
    }

    func upsertDraft(binding: EVYDraft.Binding, data: Data) throws {
        if let existing = draftIfPresent(binding: binding) {
            existing.data = data
        } else {
            context.insert(EVYDraft(binding: binding, data: data))
        }
        NotificationCenter.default.post(name: .evyDataUpdated, object: binding.notificationKey)
    }

    func updateDraft(binding: EVYDraft.Binding, data: Data) throws {
        let existing = try draft(binding: binding)
        existing.data = data
        NotificationCenter.default.post(name: .evyDataUpdated, object: binding.notificationKey)
    }

    func deleteDrafts(scopeId: String) {
        do {
            let descriptor = FetchDescriptor<EVYDraft>(predicate: #Predicate { $0.scopeId == scopeId })
            let rows = try context.fetch(descriptor)
            for row in rows {
                context.delete(row)
            }
        } catch {
            #if DEBUG
            print("[EVYDataManager] deleteDrafts error: \(error)")
            #endif
        }
    }

    func deleteAllDraftsForTestIsolation() {
        do {
            let descriptor = FetchDescriptor<EVYDraft>()
            for row in try context.fetch(descriptor) {
                context.delete(row)
            }
        } catch {
            #if DEBUG
            print("[EVYDataManager] deleteAllDraftsForTestIsolation error: \(error)")
            #endif
        }
    }

    func draftBinding(fromParsedProps parsed: String, scopeId: String? = nil) throws -> EVYDraft.Binding {
        try EVYDraft.binding(
            parsedProps: parsed,
            scopeId: scopeId ?? activeDraftScopeId
        )
    }
}
