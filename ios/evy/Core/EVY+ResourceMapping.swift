//
//  EVY+ResourceMapping.swift
//  evy
//

import Foundation

// MARK: - Resource & Entity Name Mapping

extension EVY {
  static func loadCachedResourceMapping() {
    guard cachedResourceMapping.isEmpty,
      let data = UserDefaults.standard.data(forKey: "cachedResourceMapping"),
      let mapping = try? JSONDecoder().decode([String: ResourceEntry].self, from: data)
    else { return }
    applyResourceMapping(mapping, resourcesByService: nil)
  }

  static func applyResourceMapping(
    _ mapping: [String: ResourceEntry],
    resourcesByService: [String: [String]]?
  ) {
    cachedResourceMapping = mapping
    singularToPlural = [:]
    for (plural, entry) in mapping {
      singularToPlural[entry.singular] = plural
    }
  }

  static func resourceName(forEntityKey entityKey: String) -> String {
    if let plural = singularToPlural[entityKey] {
      return plural
    }

    if cachedResourceMapping[entityKey] != nil {
      return entityKey
    }

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

  private static func inflectLastSegment(of key: String, to number: Morphology.GrammaticalNumber)
    -> String
  {
    let parts = key.split(separator: "_").map(String.init)
    guard let lastPart = parts.last else { return key }
    return (parts.dropLast() + [inflect(lastPart, to: number)]).joined(separator: "_")
  }

  private static func inflect(_ word: String, to number: Morphology.GrammaticalNumber) -> String {
    var morphology = Morphology()
    morphology.number = number

    var attrStr = AttributedString(word)
    attrStr[AttributeScopes.FoundationAttributes.InflectionRuleAttribute.self] = InflectionRule(
      morphology: morphology)

    let inflected = attrStr.inflected()
    return String(inflected.characters)
  }
}
