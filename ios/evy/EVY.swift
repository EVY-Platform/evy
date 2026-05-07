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

struct SyncParams: Encodable {
  let lastSyncTime: String
}

struct SyncRow: Codable {
  let service: String
  let resource: String
  let value: EVYJson
}

struct SyncResponse: Codable {
  let resources: SyncResources?
  let data: [SyncRow]
}

struct SyncResources: Codable {
  let resources: [String: ResourceEntry]
  let resourcesByService: [String: [String]]
}

struct ResourceEntry: Codable, Equatable {
  let singular: String
  let plural: String
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
  static var activeCachePrefix: String?

  // MARK: - Resource Mapping

  static var cachedResourceMapping: [String: ResourceEntry] = [:]

  static var singularToPlural: [String: String] = [:]

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
