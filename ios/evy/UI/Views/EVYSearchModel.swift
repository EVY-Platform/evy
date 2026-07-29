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
      // The formatter resolves each row's templates internally and takes no
      // scope of its own, so the scope has to be installed around the call.
      return try EVY.withScope(.cache(scopeId)) {
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
    return makeResults(
      from: onlyOpenRequests(
        in: try? EVY.getDataFromText(source, scope: .cache(scopeId)),
        source: source
      ),
      resultTemplate: resultTemplate,
      scopeId: scopeId
    )
  }

  /// A message list shows the requests still waiting on someone: open ones, and not the
  /// messages that settle them.
  ///
  /// Dropping the settling messages is what stops the inbox rendering "pickup request" twice,
  /// once for the ask and once for the reply. Dropping the requests they settle is what makes
  /// answering visible: nothing about a request changes when it is answered - the answer is a
  /// separate record - so a list that kept showing it would keep showing it exactly as it was,
  /// affordance and all.
  ///
  /// Hard-coded alongside the rest of the transfer-request rule (see `EVYMessageRequest`),
  /// because a `Search` child cannot filter per result: `visible` is evaluated with no datum.
  @MainActor
  private static func onlyOpenRequests(
    in sourceData: EVYJson?,
    source: String
  ) -> EVYJson? {
    guard case .array(let rows) = sourceData,
      EVY.parsePropsFromText(source) == EVYCoreResource.messages.rawValue
    else {
      return sourceData
    }
    return .array(
      rows.filter { row in
        guard !EVYMessageRequest.isResponse(row) else { return false }
        guard let request = EVYMessageRequest.classify(row) else { return true }
        return !EVYMessageRequest.isSettled(request)
      })
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
        resultTemplate: resultTemplate,
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
