//
//  EVY+QueryParams.swift
//  evy
//

import Foundation

extension EVY {
  static func cacheQueryParams(_ query: [String: [String]], forPageId pageId: String) {
    activeCacheScopeId = pageId
    resolveQueryParams(query)
  }

  static func resolveQueryParams(_ query: [String: [String]]) {
    guard let scopeId = activeCacheScopeId else { return }

    for (queryKey, ids) in query {
      if queryKey == "id",
        storeResolvedEntityQueryParam(scopeId: scopeId, queryKey: nil, ids: ids)
      {
        continue
      }

      if storeResolvedEntityQueryParam(scopeId: scopeId, queryKey: queryKey, ids: ids) {
        continue
      }

      if publicStore.namespace(forSyncedResource: queryKey) == nil {
        _ = storeRawQueryParam(scopeId: scopeId, queryKey: queryKey, ids: ids)
      }
    }
  }

  private static func storeResolvedEntityQueryParam(
    scopeId: String,
    queryKey: String?,
    ids: [String]
  ) -> Bool {
    guard let id = ids.first else { return false }

    for candidate in resolvedEntityCollections(for: queryKey) {
      guard case .array(let collectionValues) = candidate.collection,
        let matchingValue = collectionValues.first(where: { $0.identifierValue() == id }),
        let encodedMatchingValue = try? JSONEncoder().encode(matchingValue)
      else {
        continue
      }

      cacheResolvedEntity(
        scopeId: scopeId,
        cacheKey: candidate.cacheKey,
        value: encodedMatchingValue
      )
      return true
    }

    return false
  }

  private static func cacheResolvedEntity(scopeId: String, cacheKey: String, value: Data) {
    try? cacheStore.upsert(
      namespace: EVYNamespace.cache, resource: scopeId, id: cacheKey, value: value)

    let singularEntityKey = entityName(forResourceKey: cacheKey)
    guard singularEntityKey != cacheKey else { return }
    try? cacheStore.upsert(
      namespace: EVYNamespace.cache, resource: scopeId, id: singularEntityKey, value: value)
  }

  private static func resolvedEntityCollections(for queryKey: String?) -> [(
    cacheKey: String, collection: EVYJson
  )] {
    if let queryKey {
      // Try to reconstruct the collection from normalized rows
      if let namespace = publicStore.namespace(forSyncedResource: queryKey),
        let collection = try? publicStore.getCollectionJson(
          namespace: namespace, resource: queryKey)
      {
        return [(queryKey, collection)]
      }

      // Try the plural resource name
      let pluralKey = resourceName(forEntityKey: queryKey)
      if pluralKey != queryKey {
        if let namespace = publicStore.namespace(forSyncedResource: pluralKey),
          let collection = try? publicStore.getCollectionJson(
            namespace: namespace, resource: pluralKey)
        {
          return [(pluralKey, collection)]
        }
      }

      return []
    }

    // No query key: return all synced collections
    let syncedRows = (try? publicStore.getAll()) ?? []
    let resourceNames = Set(
      syncedRows.filter { $0.namespace != EVYNamespace.cache && $0.namespace != EVYNamespace.draft }
        .map { $0.resource })
    return resourceNames.compactMap { resource in
      guard let namespace = publicStore.namespace(forSyncedResource: resource),
        let collection = try? publicStore.getCollectionJson(
          namespace: namespace, resource: resource)
      else { return nil }
      return (resource, collection)
    }
  }

  private static func storeRawQueryParam(scopeId: String, queryKey: String, ids: [String]) -> Bool {
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
      try cacheStore.upsert(
        namespace: EVYNamespace.cache, resource: scopeId, id: queryKey, value: encodedRawQueryValue)
      return true
    } catch {
      return false
    }
  }
}
