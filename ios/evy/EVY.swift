//
//  EVY.swift
//  evy
//
//  Created by Geoffroy Lesage on 15/6/2024.
//

import Foundation
import SwiftUI

// MARK: - Supporting Types

enum EVYParamError: Error {
  case invalidProps
}

struct Filter: Encodable {
  let id: String?
}

// MARK: - Sync Types

enum EVYSyncState {
  private static let cursorKey = "syncCursor"

  /// The marker to resume from, or nil for a full sync. Opaque: it comes from
  /// the server, so the device clock cannot drop or duplicate changes.
  static var cursor: String? {
    UserDefaults.standard.string(forKey: cursorKey)
  }

  static func markSynced(cursor: String) {
    UserDefaults.standard.set(cursor, forKey: cursorKey)
  }

  // used by tests
  static func reset() {
    UserDefaults.standard.removeObject(forKey: cursorKey)
  }
}

struct SyncParams: Encodable {
  let cursor: String?
}

struct CoreAPIParams<T: Encodable>: Encodable {
  let service: String
  let method: String
  let data: T
}

struct SyncRow: Codable {
  let service: String
  let resource: String
  let value: EVYJson
}

struct SyncError: Codable {
  let service: String
  let resource: String
  let message: String
}

struct SyncResponse: Codable {
  let data: [SyncRow]
  let cursor: String
  let errors: [SyncError]?
}

// MARK: - Core

@MainActor
struct EVY {
  private static let localPrefix = "$local"
  private static let localPrefixWithSeparator = localPrefix + ":"
  private static let apiPrefix = "$api"
  private static let apiPrefixWithSeparator = apiPrefix + ":"

  static let publicStore = EVYDataStore(name: "public")
  static let privateStore = EVYDataStore(name: "private")
  static let cacheStore = EVYDataStore(name: "cache", inMemoryOnly: true)
  static let draftStore = EVYDraftStore(dataStore: cacheStore)
  static var activeCacheScopeId: String?

  /// Injectable clock so tests can pin `now()` and generated `createdAt` values
  static var nowProvider: () -> Date = { Date() }

  /// When set (e.g. in unit tests), skips fire-and-forget create/update JSON-RPC.
  static var syncTransport: ((_ method: String, _ params: any Encodable) -> Void)?

  static func nowISO8601(fractional: Bool = false) -> String {
    if fractional {
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      return formatter.string(from: nowProvider())
    }
    return nowProvider().ISO8601Format()
  }

  // MARK: - Core Utilities

  static func stripLocalPrefix(_ props: String) -> String {
    guard props.hasPrefix(localPrefixWithSeparator) else {
      return props
    }
    return String(props.dropFirst(localPrefixWithSeparator.count))
  }

  static func stripApiPrefix(_ props: String) -> String {
    guard props.hasPrefix(apiPrefixWithSeparator) else {
      return props
    }
    return String(props.dropFirst(apiPrefixWithSeparator.count))
  }

  static func store(for props: String) -> (EVYDataStore, String) {
    let localCleanProps = stripLocalPrefix(props)
    if localCleanProps != props {
      return (privateStore, localCleanProps)
    }
    let apiCleanProps = stripApiPrefix(props)
    if apiCleanProps != props {
      return (publicStore, apiCleanProps)
    }
    return (publicStore, props)
  }
}
