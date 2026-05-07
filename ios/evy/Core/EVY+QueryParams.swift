//
//  EVY+QueryParams.swift
//  evy
//

import Foundation

extension EVY {
  static func cacheQueryParams(_ query: [String: [String]], forPageId pageId: String) {
    activeCachePrefix = "\(pageId):"
    resolveQueryParams(query)
  }

  static func resolveQueryParams(_ query: [String: [String]]) {
    guard let prefix = activeCachePrefix else { return }

    for (queryKey, ids) in query {
      if queryKey == "id",
        storeResolvedEntityQueryParam(prefix: prefix, queryKey: nil, ids: ids)
      {
        continue
      }

      if storeResolvedEntityQueryParam(prefix: prefix, queryKey: queryKey, ids: ids) {
        continue
      }

      if publicStore.serviceName(forSyncedResource: queryKey) == nil {
        _ = storeRawQueryParam(prefix: prefix, queryKey: queryKey, ids: ids)
      }
    }
  }

  private static func storeResolvedEntityQueryParam(
    prefix: String,
    queryKey: String?,
    ids: [String]
  ) -> Bool {
    guard let id = ids.first else { return false }

    for candidate in resolvedEntityCollections(for: queryKey) {
      guard let collectionJson = try? candidate.data.decoded(),
        case .array(let collectionValues) = collectionJson,
        let matchingValue = collectionValues.first(where: { $0.identifierValue() == id }),
        let encodedMatchingValue = try? JSONEncoder().encode(matchingValue)
      else {
        continue
      }

      cacheResolvedEntity(
        prefix: prefix,
        cacheKey: candidate.cacheKey,
        value: encodedMatchingValue
      )
      return true
    }

    return false
  }

  private static func cacheResolvedEntity(prefix: String, cacheKey: String, value: Data) {
    try? cacheStore.upsert(key: "\(prefix)\(cacheKey)", value: value)

    let singularEntityKey = entityName(forResourceKey: cacheKey)
    guard singularEntityKey != cacheKey else { return }
    try? cacheStore.upsert(key: "\(prefix)\(singularEntityKey)", value: value)
  }

  private static func resolvedEntityCollections(for queryKey: String?) -> [(
    cacheKey: String, data: EVYData
  )] {
    if let queryKey {
      let serviceName = publicStore.serviceName(forSyncedResource: queryKey)
      guard let data = collectionData(for: queryKey, serviceName: serviceName) else { return [] }
      return [(queryKey, data)]
    }

    let syncedCollections = (try? publicStore.getAll()) ?? []
    return syncedCollections.compactMap { collectionData in
      let keyParts = collectionData.key.split(separator: ":", maxSplits: 1).map(String.init)
      guard keyParts.count == 2 else { return nil }
      return (keyParts[1], collectionData)
    }
  }

  private static func storeRawQueryParam(prefix: String, queryKey: String, ids: [String]) -> Bool {
    let rawQueryValue: EVYJson =
      if ids.count == 1, let id = ids.first {
        .string(id)
      } else {
        .array(ids.map { .string($0) })
      }
    guard let encodedRawQueryValue = try? JSONEncoder().encode(rawQueryValue) else {
      return false
    }
    do {
      try cacheStore.upsert(key: "\(prefix)\(queryKey)", value: encodedRawQueryValue)
      return true
    } catch {
      return false
    }
  }

  private static func collectionData(for collectionKey: String, serviceName: String?) -> EVYData? {
    if let serviceName {
      return try? publicStore.getSyncedResource(resource: collectionKey, serviceName: serviceName)
    }
    return try? publicStore.getForBinding(key: collectionKey)
  }
}
