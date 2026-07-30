//
//  EVYResourceRef.swift
//  evy
//

import Foundation

enum EVYResourceRefError: Error {
  case invalidRef(String)
}

enum EVYResourceRef {
  private static let resourceRefPattern =
    /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/
  private static let reservedServiceSlugs: Set<String> = [
    EVYNamespace.local,
    EVYNamespace.cache,
    EVYNamespace.draft,
  ]

  static func isReservedService(_ slug: String) -> Bool {
    reservedServiceSlugs.contains(slug)
  }

  static func split(pathSegments: [String]) -> (ref: String, remaining: [String])? {
    guard pathSegments.count >= 2 else { return nil }
    let ref = "\(pathSegments[0]).\(pathSegments[1])"
    let remaining = pathSegments.count > 2 ? Array(pathSegments[2...]) : []
    return (ref, remaining)
  }

  static func parse(_ ref: String) throws -> (service: String, resource: String) {
    guard ref.wholeMatch(of: resourceRefPattern) != nil else {
      throw EVYResourceRefError.invalidRef(ref)
    }
    let dotIndex = ref.firstIndex(of: ".")!
    let service = String(ref[..<dotIndex])
    let resource = String(ref[ref.index(after: dotIndex)...])
    if isReservedService(service) {
      throw EVYResourceRefError.invalidRef(ref)
    }
    return (service, resource)
  }

  static func serviceOf(_ ref: String) throws -> String {
    try parse(ref).service
  }

  static func resourceOf(_ ref: String) throws -> String {
    try parse(ref).resource
  }

  static func isValid(_ ref: String) -> Bool {
    (try? parse(ref)) != nil
  }

  /// Candidate cache-scope row keys for a binding path, most specific first, each
  /// paired with the props left over after that key. Rows are keyed either by a
  /// full dotted resource ref (query-resolved entities) or by a plain query key,
  /// and binding text can't distinguish the two ("item.title" parses as a ref),
  /// so callers try candidates in order.
  static func cacheScopeCandidates(
    for pathSegments: [String]
  ) -> [(key: String, remaining: [String])] {
    var candidates: [(key: String, remaining: [String])] = []
    if let split = split(pathSegments: pathSegments), isValid(split.ref) {
      candidates.append((split.ref, split.remaining))
    }
    if let first = pathSegments.first, !first.isEmpty {
      candidates.append((first, Array(pathSegments.dropFirst())))
    }
    return candidates
  }
}

extension EVYCoreResource {
  init?(ref: String) {
    guard let (_, resourceSlug) = try? EVYResourceRef.parse(ref),
      let coreResource = EVYCoreResource(rawValue: resourceSlug)
    else {
      return nil
    }
    self = coreResource
  }
}
