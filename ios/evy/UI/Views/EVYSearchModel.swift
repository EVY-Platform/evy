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
      && lhs.datum == rhs.datum
      && lhs.searchableText == rhs.searchableText
      && lhs.displayRow.title == rhs.displayRow.title
      && lhs.displayRow.subtitle == rhs.displayRow.subtitle
  }

  @MainActor
  private static func variantMatches(visible: String, datum: EVYJson) -> Bool {
    let trimmed = visible.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty || trimmed == "true" {
      return true
    }
    return
      (try? evyEvaluate(trimmed, boundTo: datum) {
        try _evaluateFromText(wrappedExpression($0))
      }) ?? false
  }

  private struct PreparedVariant {
    let visible: String
    let formatter: EVYDatumRowFormatter
  }

  @MainActor
  private static func prepareVariants(_ templates: [UI_Row]) -> [PreparedVariant] {
    templates.compactMap { template in
      guard
        let formatter = try? EVYDatumRowFormatter(
          template: template,
          neutralizingVisible: true
        )
      else {
        return nil
      }
      return PreparedVariant(visible: template.visible, formatter: formatter)
    }
  }

  @MainActor
  static func makeResults(
    from sourceData: EVYJson?,
    resultTemplates: [UI_Row],
    scopeId: String?
  ) -> [EVYSearchResult] {
    guard let sourceData, !resultTemplates.isEmpty else {
      return []
    }

    let dataRows: [EVYJson]
    if case .array(let arrayValue) = sourceData {
      dataRows = arrayValue
    } else {
      dataRows = [sourceData]
    }

    let preparedVariants = prepareVariants(resultTemplates)
    guard !preparedVariants.isEmpty else {
      return []
    }

    do {
      // The formatter resolves each row's templates internally and takes no
      // scope of its own, so the scope has to be installed around the call.
      return try EVY.withScope(.cache(scopeId)) {
        return dataRows.compactMap { datum in
          guard
            let match = preparedVariants.first(where: {
              variantMatches(visible: $0.visible, datum: datum)
            }),
            let (displayRow, searchableValues) = try? match.formatter.formattedResult(
              datum: datum
            )
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
      }
    } catch {
      return []
    }
  }

  @MainActor
  static func loadLocalResults(
    source: String,
    resultTemplates: [UI_Row],
    scopeId: String?
  ) -> [EVYSearchResult] {
    return makeResults(
      from: try? EVY.getDataFromText(source, scope: .cache(scopeId)),
      resultTemplates: resultTemplates,
      scopeId: scopeId
    )
  }
}

@MainActor
@Observable
final class EVYSearchModel {
  private(set) var results: [EVYSearchResult] = []
  /// True while an API search request is in flight.
  private(set) var isSearching = false
  /// True once a search has completed (success or failure) since the last `clearResults()`.
  private(set) var hasSearched = false

  private let resultTemplates: [UI_Row]
  private let scopeId: String?
  private let requester: any EVYSearchRequesting

  init(
    method: String,
    resultTemplates: [UI_Row],
    scopeId: String?,
    requester: (any EVYSearchRequesting)? = nil
  ) {
    self.resultTemplates = resultTemplates
    self.scopeId = scopeId
    self.requester = requester ?? EVYAPISearchRequester(method: method)
  }

  func clearResults() {
    results = []
    hasSearched = false
    isSearching = false
  }

  func search(query: String) async {
    isSearching = true
    defer { isSearching = false }

    do {
      let response = try await requester.search(input: query)

      guard !Task.isCancelled else { return }

      results = EVYSearchResult.makeResults(
        from: response,
        resultTemplates: resultTemplates,
        scopeId: scopeId
      )
      hasSearched = true
    } catch {
      guard !Task.isCancelled else { return }
      results = []
      hasSearched = true
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
    }
  }
}
