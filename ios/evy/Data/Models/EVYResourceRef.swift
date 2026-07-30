//
//  EVYResourceRef.swift
//  evy
//

import Foundation

enum EVYResourceRefError: Error {
  case invalidRef(String)
  case invalidServiceSlug(String)
  case invalidResourceSlug(String)
  case reservedServiceSlug(String)
}

enum EVYResourceRef {
  private static let serviceSlugPattern =
    /^[a-z][a-z0-9_-]*$/
  private static let resourceRefPattern =
    /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/
  private static let reservedServiceSlugs: Set<String> = ["local", "cache", "draft"]

  static func parse(_ ref: String) throws -> (service: String, resource: String) {
    guard ref.wholeMatch(of: resourceRefPattern) != nil else {
      throw EVYResourceRefError.invalidRef(ref)
    }
    let dotIndex = ref.firstIndex(of: ".")!
    let service = String(ref[..<dotIndex])
    let resource = String(ref[ref.index(after: dotIndex)...])
    if reservedServiceSlugs.contains(service) {
      throw EVYResourceRefError.reservedServiceSlug(service)
    }
    return (service, resource)
  }

  static func format(service: String, resource: String) throws -> String {
    guard service.wholeMatch(of: serviceSlugPattern) != nil, !service.contains(".") else {
      throw EVYResourceRefError.invalidServiceSlug(service)
    }
    guard resource.wholeMatch(of: serviceSlugPattern) != nil, !resource.contains(".") else {
      throw EVYResourceRefError.invalidResourceSlug(resource)
    }
    if reservedServiceSlugs.contains(service) {
      throw EVYResourceRefError.reservedServiceSlug(service)
    }
    return "\(service).\(resource)"
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
