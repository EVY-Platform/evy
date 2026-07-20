//
//  EVYSearchModel.swift
//  evy
//

import Foundation
import Observation

struct EVYSearchResult: Equatable, Identifiable {
  let id: String
  let datum: EVYJson
  let displayRow: UI_Row
  let searchableText: String

  static func == (lhs: EVYSearchResult, rhs: EVYSearchResult) -> Bool {
    lhs.id == rhs.id
  }

  @MainActor
  static func makeResults(
    from sourceData: EVYJson?,
    resultTemplate: UI_Row?,
    scopeId: String?
  ) -> [EVYSearchResult] {
    guard let sourceData, let resultTemplate else {
      return []
    }

    let dataRows: [EVYJson]
    if case .array(let arrayValue) = sourceData {
      dataRows = arrayValue
    } else {
      dataRows = [sourceData]
    }

    do {
      let previous = EVY.activeCacheScopeId
      EVY.activeCacheScopeId = scopeId
      defer { EVY.activeCacheScopeId = previous }

      let formatter = try EVYDatumRowFormatter(template: resultTemplate)
      return dataRows.compactMap { datum in
        guard let (displayRow, searchableValues) = try? formatter.formattedResult(datum: datum)
        else {
          return nil
        }
        let id = datum.identifierValue()
        let searchableText = searchableValues.joined(separator: " ")
        return EVYSearchResult(
          id: id,
          datum: datum,
          displayRow: displayRow,
          searchableText: searchableText
        )
      }
    } catch {
      return []
    }
  }

  @MainActor
  static func loadLocalResults(
    source: String,
    resultTemplate: UI_Row?,
    scopeId: String?
  ) -> [EVYSearchResult] {
    let previous = EVY.activeCacheScopeId
    EVY.activeCacheScopeId = scopeId
    defer { EVY.activeCacheScopeId = previous }
    return makeResults(
      from: try? EVY.getDataFromText(source),
      resultTemplate: resultTemplate,
      scopeId: scopeId
    )
  }
}

@MainActor
@Observable
final class EVYSearchModel {
  private(set) var results: [EVYSearchResult] = []

  private let resultTemplate: UI_Row?
  private let scopeId: String?
  private let requester: any EVYSearchRequesting

  init(
    method: String,
    resultTemplate: UI_Row?,
    scopeId: String?,
    requester: (any EVYSearchRequesting)? = nil
  ) {
    self.resultTemplate = resultTemplate
    self.scopeId = scopeId
    self.requester = requester ?? EVYAPISearchRequester(method: method)
  }

  func clearResults() {
    results = []
  }

  func search(query: String) async {
    do {
      let response = try await requester.search(input: query)

      guard !Task.isCancelled else { return }

      results = EVYSearchResult.makeResults(
        from: response,
        resultTemplate: resultTemplate,
        scopeId: scopeId
      )
    } catch {
      guard !Task.isCancelled else { return }
      results = []
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
    }
  }
}
