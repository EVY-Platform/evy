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

struct GetParams: Encodable {
  let service: String
  let resource: String
  let filter: Filter?
}

struct Filter: Encodable {
  let id: String?
}

struct SyncServiceDataParams: Encodable {
  let service: String
  let lastSyncTime: String
}

struct SyncedServiceDataRow: Codable {
  let service: String
  let resource: String
  let value: EVYJson
}

struct SyncServiceDataResponse: Codable {
  let data: [SyncedServiceDataRow]
}

struct ResourceEntry: Codable, Equatable {
  let singular: String
  let plural: String
}

// MARK: - Core

@MainActor
struct EVY {
  private static let localPrefix = "$local"
  private static let localPrefixWithSeparator = localPrefix + PROP_SEPARATOR

  static let publicStore = EVYDataStore(name: "public")
  static let privateStore = EVYDataStore(name: "private")
  static let cacheStore = EVYDataStore(name: "cache", inMemoryOnly: true)
  static let draftStore = EVYDraftStore(dataStore: cacheStore)
  static var activeCachePrefix: String?

  // MARK: - Resource Mapping

  static var cachedResourceMapping: [String: ResourceEntry] = [:]

  static var singularToPlural: [String: String] = [:]

  static var syncableServices: [String] = []

  // MARK: - Core Utilities

  static func stripLocalPrefix(_ props: String) -> String {
    guard props.hasPrefix(localPrefixWithSeparator) else {
      return props
    }
    return String(props.dropFirst(localPrefixWithSeparator.count))
  }

  static func store(for props: String) -> (EVYDataStore, String) {
    let cleanProps = stripLocalPrefix(props)
    let isLocalProps = cleanProps != props
    return (isLocalProps ? privateStore : publicStore, cleanProps)
  }

  static func getSDUI() async throws -> [UI_Flow] {
    try await EVYAPIManager.shared.fetch(
      method: "get", params: GetParams(service: "evy", resource: "sdui", filter: nil),
      expecting: [UI_Flow].self)
  }
}
