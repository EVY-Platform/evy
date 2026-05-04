//
//  EVYSearchController.swift
//  evy
//
//  Created by Geoffroy Lesage on 22/8/2024.
//

import Foundation
import SwiftUI

private struct EVYApiSearchSource {
  let service: String
  let resource: String
  let method: String
  let params: [EVYParamEntry]
}

private struct EVYApiSearchRequest: Encodable {
  let service: String
  let resource: String
  let method: String
  let filter: EVYApiSearchFilter
}

private struct EVYApiSearchFilter: Encodable {
  let ids: [String]?
  let queryText: String?
  let tagIds: [String]?
  let limit: Int?
  let offset: Int?
}

private enum EVYSearchSourceType {
  case api(EVYApiSearchSource)
  case local
}

public struct EVYSearchResult: Equatable {
  let data: EVYJson
  let value: String
  let displayRow: UI_Row

  public static func == (lhs: EVYSearchResult, rhs: EVYSearchResult) -> Bool {
    lhs.value == rhs.value && lhs.data == rhs.data
  }
}

// MARK: - Datum Row Template Formatting
private func deepCopyJSONValue(_ value: Any) -> Any {
  switch value {
  case let d as [String: Any]:
    var out: [String: Any] = [:]
    out.reserveCapacity(d.count)
    for (k, v) in d {
      out[k] = deepCopyJSONValue(v)
    }
    return out
  case let a as [Any]:
    return a.map { deepCopyJSONValue($0) }
  default:
    return value
  }
}

@MainActor
final class EVYDatumRowFormatter {
  private let rootPrototype: [String: Any]
  private static let displayKeys = [
    "title", "subtitle", "text", "label", "placeholder", "value",
  ]

  private static let datumReferenceRegex = try! NSRegularExpression(
    pattern: #"\{\$datum:([A-Za-z0-9_.-]+)\}"#
  )

  private static func datumValue(path: String, datum: EVYJson) -> String {
    let pathSegments = path.split(separator: ".").map(String.init)
    if pathSegments.isEmpty {
      return datum.toString()
    }

    var currentValue = datum
    for pathSegment in pathSegments {
      switch currentValue {
      case .dictionary(let dictionaryValue):
        guard let nextValue = dictionaryValue[pathSegment] else {
          return ""
        }
        currentValue = nextValue
      case .array(let arrayValue):
        guard let index = Int(pathSegment), arrayValue.indices.contains(index) else {
          return ""
        }
        currentValue = arrayValue[index]
      default:
        return ""
      }
    }

    return currentValue.toString()
  }

  private static func formatDatumReferences(_ template: String, datum: EVYJson) -> String {
    var formattedTemplate = template
    let templateRange = NSRange(template.startIndex..., in: template)
    let matches = datumReferenceRegex.matches(in: template, range: templateRange)

    for match in matches.reversed() {
      guard let fullRange = Range(match.range, in: formattedTemplate),
        let pathRange = Range(match.range(at: 1), in: formattedTemplate)
      else {
        continue
      }

      let path = String(formattedTemplate[pathRange])
      formattedTemplate.replaceSubrange(
        fullRange,
        with: datumValue(path: path, datum: datum)
      )
    }

    return formattedTemplate
  }

  private static func formatDatumReferencesInJSONValue(_ value: Any, datum: EVYJson) -> Any {
    switch value {
    case let stringValue as String:
      return formatDatumReferences(stringValue, datum: datum)
    case let dictionaryValue as [String: Any]:
      return dictionaryValue.mapValues { nestedValue in
        formatDatumReferencesInJSONValue(nestedValue, datum: datum)
      }
    case let arrayValue as [Any]:
      return arrayValue.map { nestedValue in
        formatDatumReferencesInJSONValue(nestedValue, datum: datum)
      }
    default:
      return value
    }
  }

  init(template: UI_Row) throws {
    let data = try JSONEncoder().encode(template)
    guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw EVYDatumRowFormattingError.invalidTemplate
    }
    rootPrototype = root
  }

  func formattedResult(datum: EVYJson) throws -> (row: UI_Row, value: String) {
    guard var root = Self.formatDatumReferencesInJSONValue(
      deepCopyJSONValue(rootPrototype),
      datum: datum
    ) as? [String: Any],
      let view = root["view"] as? [String: Any],
      let content = view["content"] as? [String: Any]
    else {
      throw EVYDatumRowFormattingError.invalidTemplate
    }
    let value =
      Self.displayKeys
      .compactMap { content[$0] as? String }
      .first(where: { !$0.isEmpty }) ?? ""
    root["id"] = UUID().uuidString
    let out = try JSONSerialization.data(withJSONObject: root)
    return (try JSONDecoder().decode(UI_Row.self, from: out), value)
  }
}

enum EVYDatumRowFormattingError: Error {
  case invalidTemplate
}

@MainActor
class EVYSearchController: ObservableObject {
  private static let apiSourcePrefix = "$api:"
  private static let searchDebounceNanoseconds: UInt64 = 250_000_000

  private let sourceType: EVYSearchSourceType
  private let resultTemplate: UI_Row?

  private var cachedFormatPrep: EVYDatumRowFormatter?
  private var searchTask: Task<Void, Never>?

  @Published var results: [EVYSearchResult] = []

  deinit {
    searchTask?.cancel()
  }

  init(source: String, resultTemplate: UI_Row?) {
    self.resultTemplate = resultTemplate
    sourceType = Self.searchSourceType(for: source)
  }

  private static func searchSourceType(for source: String) -> EVYSearchSourceType {
    guard let binding = parseFullBracedBinding(source),
      binding.hasPrefix(apiSourcePrefix)
    else {
      return .local
    }

    let parsedSource = parseSourceParams(binding)
    guard parsedSource.basePath.hasPrefix(apiSourcePrefix) else {
      return .local
    }
    let apiPath = String(parsedSource.basePath.dropFirst(apiSourcePrefix.count))
    let pathSegments = apiPath.split(separator: ":", omittingEmptySubsequences: false).map(
      String.init)
    guard pathSegments.count == 3,
      pathSegments.allSatisfy({ !$0.isEmpty })
    else {
      return .local
    }

    return .api(
      EVYApiSearchSource(
        service: pathSegments[0],
        resource: pathSegments[1],
        method: pathSegments[2],
        params: parsedSource.params
      )
    )
  }

  private static func buildFilter(queryText: String, params: [EVYParamEntry]) -> EVYApiSearchFilter {
    let resolvedParams = EVY.resolveParams(params)
    return EVYApiSearchFilter(
      ids: stringArray(from: resolvedParams["ids"]),
      queryText: queryText.isEmpty ? stringValue(from: resolvedParams["query_text"]) : queryText,
      tagIds: stringArray(from: resolvedParams["tag_ids"]),
      limit: intValue(from: resolvedParams["limit"]),
      offset: intValue(from: resolvedParams["offset"])
    )
  }

  private static func stringArray(from value: EVYJson?) -> [String]? {
    guard let value else { return nil }
    switch value {
    case .array(let arrayValue):
      return arrayValue.map { $0.toString() }
    case .string(let stringValue):
      return stringValue.isEmpty ? nil : [stringValue]
    default:
      return nil
    }
  }

  private static func stringValue(from value: EVYJson?) -> String? {
    guard let value else { return nil }
    switch value {
    case .string(let stringValue):
      return stringValue.isEmpty ? nil : stringValue
    case .array(let arrayValue):
      return arrayValue.first?.toString()
    default:
      return value.toString()
    }
  }

  private static func intValue(from value: EVYJson?) -> Int? {
    guard let value else { return nil }
    switch value {
    case .int(let intValue):
      return intValue
    case .decimal(let decimalValue):
      return NSDecimalNumber(decimal: decimalValue).intValue
    case .string(let stringValue):
      return Int(stringValue)
    default:
      return nil
    }
  }

  private func loadFormatPrep() throws -> EVYDatumRowFormatter {
    if let prep = cachedFormatPrep {
      return prep
    }
    guard let resultTemplate else {
      throw EVYDatumRowFormattingError.invalidTemplate
    }
    let prep = try EVYDatumRowFormatter(template: resultTemplate)
    cachedFormatPrep = prep
    return prep
  }

  func makeSearchResult(datum: EVYJson) throws -> EVYSearchResult {
    let (row, value) = try loadFormatPrep().formattedResult(datum: datum)
    return EVYSearchResult(data: datum, value: value, displayRow: row)
  }

  func debouncedSearch(name: String) {
    searchTask?.cancel()

    guard !name.isEmpty else {
      results.removeAll()
      return
    }

    searchTask = Task { [weak self] in
      do {
        try await Task.sleep(nanoseconds: Self.searchDebounceNanoseconds)
      } catch {
        return
      }

      guard !Task.isCancelled else {
        return
      }

      await self?.search(name: name)
    }
  }

  func search(name: String) async {
    guard resultTemplate != nil else {
      results = []
      return
    }

    switch sourceType {
    case .local:
      let address = """
            {
                "unit": "100",
                "street": "Main Street",
                "city": "Rosebery",
                "postcode": "2018",
                "state": "NSW",
                "country": "Australia",
                "location": {
                    "latitude": "45.323124",
                    "longitude": "-3.424233"
                },
                "instructions": ""
            }
        """.data(using: .utf8)!
      let id = UUID()
      do {
        try EVY.publicStore.create(key: id.uuidString, data: address)
        let json = try EVY.getDataFromProps(id.uuidString)
        results = [try makeSearchResult(datum: json)]
      } catch {
        results = []
      }
    case .api(let apiSource):
      do {
        let response = try await EVYAPIManager.shared.fetch(
          method: "api",
          params: EVYApiSearchRequest(
            service: apiSource.service,
            resource: apiSource.resource,
            method: apiSource.method,
            filter: Self.buildFilter(queryText: name, params: apiSource.params)
          ),
          expecting: [EVYJson].self
        )
        results = try response.map { try makeSearchResult(datum: $0) }
      } catch {
        results = []
      }
    }
  }
}


