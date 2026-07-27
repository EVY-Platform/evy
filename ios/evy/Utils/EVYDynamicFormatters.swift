//
//  EVYDynamicFormatters.swift
//  evy
//

import Foundation

private struct EVYFormatterDefinition {
  let formattingConfig: String
  let formatting: [String: String]
}

private func evyResolveInputInterpolations(
  _ template: String,
  input: EVYJson
) -> String {
  guard case .dictionary(let dict) = input else {
    return template
  }

  let pattern = #"\{input\.([a-zA-Z_][a-zA-Z0-9_]*)\}"#
  guard let regex = try? NSRegularExpression(pattern: pattern) else {
    return template
  }

  let nsTemplate = template as NSString
  var resolved = template
  let matches = regex.matches(
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

@MainActor
private func evyLookupFormatterDefinition(named name: String) throws -> EVYFormatterDefinition {
  guard let namespace = EVY.namespaceForSyncedResource("formatters") else {
    throw EVYError.formatFailed(type: name, reason: "formatters resource not synced")
  }
  guard
    let collection = try EVY.getSyncedCollectionJson(
      namespace: namespace, resource: "formatters"),
    case .array(let items) = collection
  else {
    throw EVYError.formatFailed(type: name, reason: "formatters collection missing")
  }

  for item in items {
    guard case .dictionary(let dict) = item,
      case .string(let formatterName) = dict["name"],
      formatterName == name,
      case .string(let formattingConfig) = dict["formatting_config"],
      case .dictionary(let formattingDict) = dict["formatting"]
    else {
      continue
    }

    let formatting = formattingDict.reduce(into: [String: String]()) { result, entry in
      result[entry.key] = entry.value.toString()
    }
    return EVYFormatterDefinition(
      formattingConfig: formattingConfig,
      formatting: formatting
    )
  }

  throw EVYError.formatFailed(type: name, reason: "formatter not found")
}

private func evyLookupFormatterTemplate(
  _ formatting: [String: String],
  key: String,
  formatterName: String
) throws -> String {
  let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
  if let exact = formatting[trimmedKey] {
    return exact
  }
  for (candidateKey, template) in formatting {
    if candidateKey.caseInsensitiveCompare(trimmedKey) == .orderedSame {
      return template
    }
  }
  if let defaultTemplate = formatting["default"] {
    return defaultTemplate
  }
  for (candidateKey, template) in formatting
  where candidateKey.caseInsensitiveCompare("default")
    == .orderedSame
  {
    return template
  }
  throw EVYError.formatFailed(
    type: formatterName,
    reason: "no formatting template for key '\(trimmedKey)' and no default"
  )
}

private func evySanitizeFormatterTemplate(_ template: String, input: EVYJson) -> String {
  guard case .dictionary(let dict) = input else {
    return evyTidyFormatterSeparators(template)
  }

  let pattern = #"\{input\.([a-zA-Z_][a-zA-Z0-9_]*)\}"#
  guard let regex = try? NSRegularExpression(pattern: pattern) else {
    return evyTidyFormatterSeparators(template)
  }

  let nsTemplate = template as NSString
  var sanitized = template
  let matches = regex.matches(
    in: template,
    range: NSRange(location: 0, length: nsTemplate.length)
  ).reversed()

  for match in matches {
    guard match.numberOfRanges >= 2 else { continue }
    let fieldRange = match.range(at: 1)
    let fieldName = nsTemplate.substring(with: fieldRange)
    let fieldValue =
      dict[fieldName]?.toString().trimmingCharacters(in: .whitespacesAndNewlines)
      ?? ""
    let replacement = fieldValue.isEmpty ? "" : fieldValue
    let fullRange = match.range(at: 0)
    sanitized = (sanitized as NSString).replacingCharacters(in: fullRange, with: replacement)
  }

  return evyTidyFormatterSeparators(sanitized)
}

private func evyTidyFormatterSeparators(_ text: String) -> String {
  var sanitized = text
  while sanitized.contains("  ") {
    sanitized = sanitized.replacingOccurrences(of: "  ", with: " ")
  }
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
  let formatter = try evyLookupFormatterDefinition(named: name)
  var input = try EVY.getDataFromProps(args)
  if name == "formatCurrency" {
    input = evyNormalizePriceInput(input)
  }

  if editing, name == "formatCurrency" {
    return try evyCurrencyEditingOutput(from: input)
  }

  if name == "formatCurrency", case .dictionary(let dict) = input {
    let rawValue = dict["value"]?.toString().trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if rawValue.isEmpty {
      return EVYFunctionOutput(value: "", prefix: nil, suffix: nil)
    }
  }

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
  case .string(let stringValue):
    return .dictionary([
      "currency": .string("AUD"),
      "value": .string(stringValue),
    ])
  case .int(let intValue):
    return .dictionary([
      "currency": .string("AUD"),
      "value": .string(String(intValue)),
    ])
  case .decimal(let decimalValue):
    return .dictionary([
      "currency": .string("AUD"),
      "value": .string("\(decimalValue)"),
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
  case .string(let stringValue):
    rawValue = stringValue
  case .int(let intValue):
    rawValue = String(intValue)
  case .decimal(let decimalValue):
    rawValue = "\(decimalValue)"
  default:
    throw EVYError.formatFailed(type: "currency", reason: "expected dictionary, got \(input)")
  }

  let trimmedValue = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
  return EVYFunctionOutput(value: trimmedValue, prefix: nil, suffix: nil)
}

#if DEBUG
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
        "createdAt": .string(now),
        "updatedAt": .string(now),
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
        "createdAt": .string(now),
        "updatedAt": .string(now),
      ]),
    ]

    try EVY.publicStore.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: "formatters",
      value: .array(formatters)
    )
  }
#endif
