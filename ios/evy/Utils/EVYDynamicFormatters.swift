//
//  EVYDynamicFormatters.swift
//  evy
//

import Foundation

private struct EVYFormatterDefinition {
  let formattingConfig: String
  let formatting: [String: String]
}

private let evyInputInterpolationRegex = try! NSRegularExpression(
  pattern: #"\{input\.([a-zA-Z_][a-zA-Z0-9_]*)\}"#
)

private func evyResolveInputInterpolations(
  _ template: String,
  input: EVYJson
) -> String {
  guard case .dictionary(let dict) = input else {
    return template
  }

  let nsTemplate = template as NSString
  var resolved = template
  let matches = evyInputInterpolationRegex.matches(
    in: template,
    range: NSRange(location: 0, length: nsTemplate.length)
  ).reversed()

  for match in matches {
    guard match.numberOfRanges >= 2 else { continue }
    let fieldName = nsTemplate.substring(with: match.range(at: 1))
    let fieldValue =
      dict[fieldName]?.toString().trimmingCharacters(in: .whitespacesAndNewlines)
      ?? ""
    resolved = (resolved as NSString).replacingCharacters(
      in: match.range(at: 0),
      with: fieldValue
    )
  }

  return resolved
}

/// Formatter rows change once per sync but are read on every interpolation, so
/// the decoded definitions are held until any store write bumps the generation.
@MainActor
private var evyFormatterDefinitionCache:
  (generation: Int, definitions: [String: EVYFormatterDefinition])?

@MainActor
private func evyFormatterDefinitions(requestedBy name: String) throws
  -> [String: EVYFormatterDefinition]
{
  if let cache = evyFormatterDefinitionCache, cache.generation == evyDataStoreGeneration {
    return cache.definitions
  }

  let formattersRef = EVYCoreResource.formatters.ref

  guard
    let collection = try EVY.getSyncedCollectionJson(
      namespace: EVYNamespace.evy, resource: formattersRef),
    case .array(let items) = collection
  else {
    throw EVYError.formatFailed(type: name, reason: "formatters collection missing")
  }

  var definitions: [String: EVYFormatterDefinition] = [:]
  for item in items {
    guard case .dictionary(let dict) = item,
      case .string(let formatterName) = dict["name"],
      case .string(let formattingConfig) = dict["formatting_config"],
      case .dictionary(let formattingDict) = dict["formatting"]
    else {
      continue
    }

    definitions[formatterName] = EVYFormatterDefinition(
      formattingConfig: formattingConfig,
      formatting: formattingDict.mapValues { $0.toString() }
    )
  }

  evyFormatterDefinitionCache = (evyDataStoreGeneration, definitions)
  return definitions
}

@MainActor
private func evyLookupFormatterDefinition(named name: String) throws -> EVYFormatterDefinition {
  guard let definition = try evyFormatterDefinitions(requestedBy: name)[name] else {
    throw EVYError.formatFailed(type: name, reason: "formatter not found")
  }
  return definition
}

private func evyFormattingTemplate(_ formatting: [String: String], _ key: String) -> String? {
  formatting[key]
    ?? formatting.first { $0.key.caseInsensitiveCompare(key) == .orderedSame }?.value
}

private func evyLookupFormatterTemplate(
  _ formatting: [String: String],
  key: String,
  formatterName: String
) throws -> String {
  let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
  guard
    let template = evyFormattingTemplate(formatting, trimmedKey)
      ?? evyFormattingTemplate(formatting, "default")
  else {
    throw EVYError.formatFailed(
      type: formatterName,
      reason: "no formatting template for key '\(trimmedKey)' and no default"
    )
  }
  return template
}

private func evySanitizeFormatterTemplate(_ template: String, input: EVYJson) -> String {
  evyTidyFormatterSeparators(evyResolveInputInterpolations(template, input: input))
}

private func evyTidyFormatterSeparators(_ text: String) -> String {
  var sanitized = text.replacingOccurrences(
    of: " {2,}", with: " ", options: .regularExpression)
  while sanitized.contains(", ,") {
    sanitized = sanitized.replacingOccurrences(of: ", ,", with: ", ")
  }
  sanitized = sanitized.replacingOccurrences(of: " ,", with: ",")
  sanitized = sanitized.trimmingCharacters(in: .whitespacesAndNewlines)
  sanitized = sanitized.trimmingCharacters(in: CharacterSet(charactersIn: ","))
  sanitized = sanitized.trimmingCharacters(in: .whitespacesAndNewlines)
  if sanitized.allSatisfy({ $0.isWhitespace || $0 == "," }) {
    return ""
  }
  return sanitized
}

@MainActor
func evyEvaluateDynamicFormatter(
  name: String,
  args: String,
  editing: Bool = false
) throws -> EVYFunctionOutput {
  var input = try EVY.getDataFromProps(args)

  // Currency is the one formatter whose input shape and editing representation
  // are not expressible in a synced template, so it shortcuts before the
  // template lookup - which is also the expensive part on the per-keystroke path.
  if name == "formatCurrency" {
    input = evyNormalizePriceInput(input)
    if editing {
      return try evyCurrencyEditingOutput(from: input)
    }
    if case .dictionary(let dict) = input,
      (dict["value"]?.toString().trimmingCharacters(in: .whitespacesAndNewlines) ?? "").isEmpty
    {
      return EVYFunctionOutput(value: "", prefix: nil, suffix: nil)
    }
  }

  let formatter = try evyLookupFormatterDefinition(named: name)
  return try evyWithEphemeralDatum(key: "input", value: input) {
    let configKey = evyResolveInputInterpolations(formatter.formattingConfig, input: input)
    let template = try evyLookupFormatterTemplate(
      formatter.formatting,
      key: configKey,
      formatterName: name
    )
    let sanitizedTemplate = evySanitizeFormatterTemplate(template, input: input)
    if sanitizedTemplate.contains("{") {
      let output = try _getValueFromText(sanitizedTemplate, editing: editing)
      return EVYFunctionOutput(value: output.toString(), prefix: nil, suffix: nil)
    }
    return EVYFunctionOutput(value: sanitizedTemplate, prefix: nil, suffix: nil)
  }
}

private func evyNormalizePriceInput(_ input: EVYJson) -> EVYJson {
  switch input {
  case .dictionary(let dictValue):
    if dictValue["currency"] != nil {
      return input
    }
    return .dictionary(dictValue.merging(["currency": .string("AUD")]) { _, new in new })
  case .string, .int, .decimal:
    return .dictionary([
      "currency": .string("AUD"),
      "value": .string(input.toString()),
    ])
  default:
    return input
  }
}

@MainActor
private func evyCurrencyEditingOutput(from input: EVYJson) throws -> EVYFunctionOutput {
  let rawValue: String
  switch input {
  case .dictionary(let dictValue):
    guard let value = dictValue["value"] else {
      throw EVYError.formatFailed(type: "currency", reason: "missing 'value' field")
    }
    rawValue = value.toString()
  case .string, .int, .decimal:
    rawValue = input.toString()
  default:
    throw EVYError.formatFailed(type: "currency", reason: "expected dictionary, got \(input)")
  }

  let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
  return EVYFunctionOutput(value: trimmedValue, prefix: nil, suffix: nil)
}

#if DEBUG
  /// Mirrors types/standardFormatters.ts, which is what the seed script actually
  /// inserts. Swift cannot import it, so the rows are repeated here - keep both
  /// in step when a standard formatter changes.
  @MainActor
  func evySeedStandardFormattersForTests() throws {
    let now = ISO8601DateFormatter().string(from: Date())
    let formatters: [EVYJson] = [
      .dictionary([
        "id": .string("f1e2d3c4-b5a6-4789-8abc-def012345601"),
        "name": .string("formatCurrency"),
        "formatting_config": .string("{input.currency}"),
        "formatting": .dictionary([
          "AUD": .string("${formatDecimal(input.value, 2)}"),
          "EUR": .string("€{formatDecimal(input.value, 2)}"),
          "default": .string("${formatDecimal(input.value, 2)}"),
        ]),
        "created_at": .string(now),
        "updated_at": .string(now),
      ]),
      .dictionary([
        "id": .string("f1e2d3c4-b5a6-4789-8abc-def012345602"),
        "name": .string("formatAddress"),
        "formatting_config": .string("{input.country}"),
        "formatting": .dictionary([
          "Australia": .string(
            "{input.unit} {input.street}, {input.postcode} {input.city} {input.state}"),
          "United States": .string(
            "{input.unit} {input.street}, {input.city} {input.state} {input.postcode}"),
          "default": .string(
            "{input.unit} {input.street}, {input.postcode} {input.city} {input.state}"),
        ]),
        "created_at": .string(now),
        "updated_at": .string(now),
      ]),
    ]

    try EVY.publicStore.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.formatters.ref,
      value: .array(formatters)
    )
  }
#endif
