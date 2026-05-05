//
//  EVY+ResourceMapping.swift
//  evy
//

import Foundation

// MARK: - Resource & Entity Name Mapping

private struct ResourcesResponse: Codable {
  let resources: [String: ResourceEntry]
  let resourcesByService: [String: [String]]
}

extension EVY {
  static func fetchResourceMapping() async throws {
    let response: ResourcesResponse = try await EVYAPIManager.shared.fetch(
      method: "resources",
      params: [String: String](),
      expecting: ResourcesResponse.self
    )

    applyResourceMapping(response.resources, resourcesByService: response.resourcesByService)

    // Persist to UserDefaults for offline use
    if let encoded = try? JSONEncoder().encode(response.resources) {
      UserDefaults.standard.set(encoded, forKey: "cachedResourceMapping")
    }
  }

  static func loadCachedResourceMapping() {
    guard cachedResourceMapping.isEmpty,
          let data = UserDefaults.standard.data(forKey: "cachedResourceMapping"),
          let mapping = try? JSONDecoder().decode([String: ResourceEntry].self, from: data)
    else { return }
    applyResourceMapping(mapping, resourcesByService: nil)
  }

  private static func applyResourceMapping(
    _ mapping: [String: ResourceEntry],
    resourcesByService: [String: [String]]?
  ) {
    cachedResourceMapping = mapping
    singularToPlural = [:]
    for (plural, entry) in mapping {
      singularToPlural[entry.singular] = plural
    }
    if let resourcesByService {
      syncableServices = resourcesByService.keys.filter { $0 != "evy" }.sorted()
    }
  }

  static func resourceName(forEntityKey entityKey: String) -> String {
    // O(1) lookup via the reverse map
    if let plural = singularToPlural[entityKey] {
      return plural
    }

    // Fallback: try the key as-is (in case it's already a plural resource name)
    if cachedResourceMapping[entityKey] != nil {
      return entityKey
    }

    // Last resort: use Foundation inflection
    return legacyResourceName(forEntityKey: entityKey)
  }

  static func entityName(forResourceKey resourceKey: String) -> String {
    if let entry = cachedResourceMapping[resourceKey] {
      return entry.singular
    }
    return legacyEntityName(forResourceKey: resourceKey)
  }

  // MARK: - Legacy inflection fallbacks

  private static func legacyResourceName(forEntityKey entityKey: String) -> String {
    inflectLastSegment(of: entityKey, to: .plural)
  }

  private static func legacyEntityName(forResourceKey resourceKey: String) -> String {
    inflectLastSegment(of: resourceKey, to: .singular)
  }

  private static func inflectLastSegment(of key: String, to number: Morphology.GrammaticalNumber) -> String {
    let parts = key.split(separator: "_").map(String.init)
    guard let lastPart = parts.last else { return key }
    return (parts.dropLast() + [inflect(lastPart, to: number)]).joined(separator: "_")
  }

  private static func inflect(_ word: String, to number: Morphology.GrammaticalNumber) -> String {
    var morphology = Morphology()
    morphology.number = number

    var attrStr = AttributedString(word)
    attrStr[AttributeScopes.FoundationAttributes.InflectionRuleAttribute.self] = InflectionRule(morphology: morphology)

    let inflected = attrStr.inflected()
    return String(inflected.characters)
  }
}
