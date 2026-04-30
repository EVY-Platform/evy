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
}

private struct EVYApiSearchRequest: Encodable {
  let service: String
  let resource: String
  let method: String
  let filter: EVYApiSearchFilter
}

private struct EVYApiSearchFilter: Encodable {
  let queryText: String
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

// MARK: - Search Result Template
private func deepCopyJSONValue(_ value: Any) -> Any {
  switch value {
  case let d as [String: Any]:
    var out: [String: Any] = [:]
    out.reserveCapacity(d.count)
    for (k, v) in d {
      out[k] = deepCopyJSONValue(v)
    }
    return out
  case let d as NSDictionary:
    var out: [String: Any] = [:]
    for case (let k as String, let v) in d {
      out[k] = deepCopyJSONValue(v)
    }
    return out
  case let a as [Any]:
    return a.map { deepCopyJSONValue($0) }
  case let a as NSArray:
    return a.map { deepCopyJSONValue($0) }
  default:
    return value
  }
}

@MainActor
private final class SearchTemplateFormatPrep {
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

  init(template: UI_Row) throws {
    let data = try JSONEncoder().encode(template)
    guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw EVYSearchFormattingError.invalidTemplate
    }
    rootPrototype = root
  }

  func formattedResult(datum: EVYJson) throws -> (row: UI_Row, value: String) {
    guard var root = deepCopyJSONValue(rootPrototype) as? [String: Any],
      var view = root["view"] as? [String: Any],
      var content = view["content"] as? [String: Any]
    else {
      throw EVYSearchFormattingError.invalidTemplate
    }
    for key in Array(content.keys) {
      if let raw = content[key] as? String {
        content[key] = Self.formatDatumReferences(raw, datum: datum)
      }
    }
    let value =
      Self.displayKeys
      .compactMap { content[$0] as? String }
      .first(where: { !$0.isEmpty }) ?? ""
    view["content"] = content
    root["view"] = view
    root["id"] = UUID().uuidString
    let out = try JSONSerialization.data(withJSONObject: root)
    return (try JSONDecoder().decode(UI_Row.self, from: out), value)
  }
}

enum EVYSearchFormattingError: Error {
  case invalidTemplate
}

@MainActor
class EVYSearchController: ObservableObject {
  private static let apiSourcePrefix = "$api:"
  private static let searchDebounceNanoseconds: UInt64 = 250_000_000

  private let sourceType: EVYSearchSourceType
  private let resultTemplate: UI_Row?

  private var cachedFormatPrep: SearchTemplateFormatPrep?
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
    guard let binding = bracedBinding(from: source),
      binding.hasPrefix(apiSourcePrefix)
    else {
      return .local
    }

    let apiPath = String(binding.dropFirst(apiSourcePrefix.count))
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
        method: pathSegments[2]
      )
    )
  }

  private static func bracedBinding(from source: String) -> String? {
    let normalizedSource = source.trimmingCharacters(in: .whitespacesAndNewlines)
    let sourceProps = EVY.parsePropsFromText(normalizedSource)
    guard normalizedSource == "{\(sourceProps)}" else {
      return nil
    }

    return sourceProps
  }

  private func loadFormatPrep() throws -> SearchTemplateFormatPrep {
    if let prep = cachedFormatPrep {
      return prep
    }
    guard let resultTemplate else {
      throw EVYSearchFormattingError.invalidTemplate
    }
    let prep = try SearchTemplateFormatPrep(template: resultTemplate)
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
            filter: EVYApiSearchFilter(queryText: name)
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

#Preview {
  AsyncPreview { (asyncView: EVYSearch) in
    asyncView
  } view: {
    // Local-only: no EVY.getRow / EVYAPIManager (avoids API_HOST fatalError in Xcode canvas).
    if !EVY.publicStore.exists(key: "tags") {
      try EVY.publicStore.create(key: "tags", data: Data("[]".utf8))
    }
    let templateJson = """
      {
          "id": "preview-search-row",
          "type": "Info",
          "source": "",
          "destination": "",
          "actions": [],
          "view": {
              "content": {
                  "title": "{$datum:unit} {$datum:street}",
                  "subtitle": "{$datum:city} {$datum:state} {$datum:postcode}",
                  "icon": ""
              }
          }
      }
      """
    let template = try JSONDecoder().decode(
      UI_Row.self,
      from: Data(templateJson.utf8),
    )
    return EVYSearch(
      source: "{$local:address}",
      destination: "{tags}",
      placeholder: "Search",
      resultTemplate: template,
      actions: []
    )
  }
}
