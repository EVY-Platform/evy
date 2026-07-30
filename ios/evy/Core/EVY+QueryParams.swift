//
//  EVY+QueryParams.swift
//  evy
//

import Foundation

extension EVY {
  static let entityIdQueryKey = "id"

  private static var syncedResourceRefsCache: (generation: Int, refs: [String])?

  static func cacheQueryParams(_ query: [String: [String]], forPageId pageId: String) {
    activeCacheScopeId = pageId
    resolveQueryParams(query, cacheScopeId: pageId)
  }

  static func resolveQueryParams(
    _ query: [String: [String]],
    cacheScopeId: String? = nil
  ) {
    guard let scopeId = cacheScopeId ?? activeCacheScopeId else { return }
    let resourceRefs = syncedResourceRefs()

    for (queryKey, ids) in query {
      if queryKey == EVY.entityIdQueryKey {
        _ = storeResolvedEntityQueryParam(
          scopeId: scopeId, queryKey: nil, ids: ids, resourceRefs: resourceRefs)
        continue
      }

      if storeResolvedEntityQueryParam(
        scopeId: scopeId, queryKey: queryKey, ids: ids, resourceRefs: resourceRefs)
      {
        continue
      }

      if !EVYResourceRef.isValid(queryKey) {
        _ = storeRawQueryParam(scopeId: scopeId, queryKey: queryKey, ids: ids)
      }
    }
  }

  private static func storeResolvedEntityQueryParam(
    scopeId: String,
    queryKey: String?,
    ids: [String],
    resourceRefs: [String]
  ) -> Bool {
    guard let id = ids.first else { return false }

    for candidate in resolvedEntityCollections(for: queryKey, resourceRefs: resourceRefs) {
      guard case .array(let collectionValues) = candidate.collection,
        let matchingValue = collectionValues.first(where: { $0.identifierValue() == id }),
        let encodedMatchingValue = try? JSONEncoder().encode(matchingValue)
      else {
        continue
      }

      cacheValue(
        scopeId: scopeId,
        cacheKey: cacheKeyForResolvedEntity(
          queryKey: queryKey, resourceRef: candidate.resourceRef),
        value: encodedMatchingValue
      )
      return true
    }

    return false
  }

  private static func cacheKeyForResolvedEntity(queryKey: String?, resourceRef: String) -> String {
    if let queryKey, !queryKey.isEmpty { return queryKey }
    return resourceRef
  }

  private static func cacheValue(scopeId: String, cacheKey: String, value: Data) {
    if (try? cacheStore.get(namespace: EVYNamespace.cache, resource: scopeId, id: cacheKey)) != nil
    {
      try? cacheStore.update(
        namespace: EVYNamespace.cache, resource: scopeId, id: cacheKey, value: value)
    } else {
      try? cacheStore.create(
        namespace: EVYNamespace.cache, resource: scopeId, id: cacheKey, value: value)
    }
    EVYValueChange.post(key: cacheKey)
  }

  private static func syncedResourceRefs() -> [String] {
    if let cache = syncedResourceRefsCache, cache.generation == evyDataStoreGeneration {
      return cache.refs
    }

    var seenResources = Set<String>()
    for store in syncedStores() {
      let syncedRows = (try? store.getAll()) ?? []
      for row in syncedRows where !EVYResourceRef.isReservedService(row.namespace) {
        seenResources.insert(row.resource)
      }
    }

    let refs = seenResources.sorted()
    syncedResourceRefsCache = (evyDataStoreGeneration, refs)
    return refs
  }

  private static func resolvedEntityCollections(
    for queryKey: String?,
    resourceRefs: [String]
  ) -> [(resourceRef: String, collection: EVYJson)] {
    if let queryKey, let namespace = try? EVYResourceRef.serviceOf(queryKey),
      let collection = try? getSyncedCollectionJson(namespace: namespace, resource: queryKey)
    {
      return [(queryKey, collection)]
    }

    var results: [(resourceRef: String, collection: EVYJson)] = []
    for resourceRef in resourceRefs {
      if let queryKey, queryKey != resourceRef {
        let resourceSlug = (try? EVYResourceRef.resourceOf(resourceRef)) ?? resourceRef
        if queryKey != resourceSlug { continue }
      }
      guard let namespace = try? EVYResourceRef.serviceOf(resourceRef) else { continue }
      for store in syncedStores() {
        guard
          let collection = try? store.getCollectionJson(
            namespace: namespace, resource: resourceRef)
        else { continue }
        results.append((resourceRef, collection))
        break
      }
    }
    return results
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
    cacheValue(scopeId: scopeId, cacheKey: queryKey, value: encodedRawQueryValue)
    return true
  }
}
