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
    guard let resultTemplate, let sourceData else {
      return []
    }

    do {
      let previous = EVY.activeCacheScopeId
      EVY.activeCacheScopeId = scopeId
      defer { EVY.activeCacheScopeId = previous }

      let dataRows: [EVYJson]
      if case .array(let arrayValue) = sourceData {
        dataRows = arrayValue
      } else {
        dataRows = [sourceData]
      }

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
}

@MainActor
@Observable
final class EVYSearchModel {
  private(set) var results: [EVYSearchResult] = []

  private let method: String
  private let resultTemplate: UI_Row?
  private let scopeId: String?
  private let requester: any PlaceSearchRequesting

  private var searchTask: Task<Void, Never>?
  private var activeFetchId = UUID()

  init(
    method: String,
    resultTemplate: UI_Row?,
    scopeId: String?,
    requester: any PlaceSearchRequesting = APISearchRequester()
  ) {
    self.method = method
    self.resultTemplate = resultTemplate
    self.scopeId = scopeId
    self.requester = requester
  }

  func queryChanged(_ text: String) {
    searchTask?.cancel()

    let trimmedQuery = text.trimmingCharacters(in: .whitespacesAndNewlines)
    let lastEnteredCharacter = text.last

    switch EVYSearchQueryDispatch.decision(
      trimmedQuery: trimmedQuery,
      lastEnteredCharacter: lastEnteredCharacter
    ) {
    case .skip:
      results = []
      return
    case .dispatchNow:
      searchTask = Task {
        await performSearch(query: trimmedQuery)
      }
    case .scheduleDebounce:
      searchTask = Task {
        try? await Task.sleep(
          for: .milliseconds(EVYSearchQueryDispatch.debounceMilliseconds)
        )
        guard !Task.isCancelled else { return }
        await performSearch(query: trimmedQuery)
      }
    }
  }

  func cancelInFlightWork() {
    searchTask?.cancel()
  }

  func awaitInFlightWork() async {
    await searchTask?.value
  }

  private func performSearch(query: String) async {
    let fetchId = UUID()
    activeFetchId = fetchId

    do {
      let response = try await requester.search(method: method, input: query)

      guard !Task.isCancelled, fetchId == activeFetchId else { return }

      let dataRows: [EVYJson]
      if case .array(let arrayValue) = response {
        dataRows = arrayValue
      } else {
        dataRows = []
      }

      results = EVYSearchResult.makeResults(
        from: .array(dataRows),
        resultTemplate: resultTemplate,
        scopeId: scopeId
      )
    } catch {
      guard fetchId == activeFetchId else { return }
      results = []
      #if DEBUG
        print("[EVYSearchModel] place search '\(method)' failed: \(error)")
      #endif
      NotificationCenter.default.post(name: .evyErrorOccurred, object: error)
    }
  }
}
