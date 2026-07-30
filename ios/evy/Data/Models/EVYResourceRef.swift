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
  private static let reservedServiceSlugs: Set<String> = ["local", "cache", "draft"]

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

  static func isValid(_ ref: String) -> Bool {
    (try? parse(ref)) != nil
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
