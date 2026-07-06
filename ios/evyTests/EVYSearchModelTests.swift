//
//  EVYSearchModelTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYSearchModelTests: XCTestCase {
  private final class PlaceSearchRequestingSpy: PlaceSearchRequesting, @unchecked Sendable {
    struct Call: Equatable {
      let method: String
      let input: String
    }

    private(set) var calls: [Call] = []
    var response: EVYJson = .array([])
    var searchHandler: ((String) async throws -> EVYJson)?

    func search(method: String, input: String) async throws -> EVYJson {
      calls.append(Call(method: method, input: input))
      if let searchHandler {
        return try await searchHandler(input)
      }
      return response
    }
  }

  func testSearchCallsRequesterOnceAndPopulatesResults() async {
    let spy = PlaceSearchRequestingSpy()
    let resultTemplate = Self.makeResultTemplate()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: resultTemplate,
      scopeId: nil,
      requester: spy
    )
    spy.response = .array([
      .dictionary([
        "id": .string("place-1"),
        "street": .string("George Street"),
        "city": .string("Sydney"),
      ])
    ])

    await model.search(query: "Sydney")

    XCTAssertEqual(spy.calls.count, 1)
    XCTAssertEqual(spy.calls[0].method, "place_search")
    XCTAssertEqual(spy.calls[0].input, "Sydney")
    XCTAssertEqual(model.results.count, 1)
    XCTAssertEqual(model.results[0].id, "place-1")
  }

  func testClearResultsEmptiesResults() async {
    let spy = PlaceSearchRequestingSpy()
    let resultTemplate = Self.makeResultTemplate()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: resultTemplate,
      scopeId: nil,
      requester: spy
    )
    spy.response = .array([
      .dictionary([
        "id": .string("place-1"),
        "street": .string("George Street"),
        "city": .string("Sydney"),
      ])
    ])

    await model.search(query: "Sydney")
    XCTAssertFalse(model.results.isEmpty)

    model.clearResults()
    XCTAssertTrue(model.results.isEmpty)
  }

  func testOutOfOrderResponsesAreIgnored() async {
    let spy = PlaceSearchRequestingSpy()
    let resultTemplate = Self.makeResultTemplate()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: resultTemplate,
      scopeId: nil,
      requester: spy
    )
    let slowSearchStarted = expectation(description: "slow search started")

    spy.searchHandler = { input in
      if input == "slow" {
        slowSearchStarted.fulfill()
        try await Task.sleep(for: .milliseconds(300))
        return .array([
          .dictionary([
            "id": .string("slow-result"),
            "street": .string("Slow Street"),
            "city": .string("Slowville"),
          ])
        ])
      }
      return .array([
        .dictionary([
          "id": .string("fast-result"),
          "street": .string("Fast Street"),
          "city": .string("Fastville"),
        ])
      ])
    }

    async let slowSearch: Void = model.search(query: "slow")
    await fulfillment(of: [slowSearchStarted], timeout: 1.0)
    await model.search(query: "fast")
    await slowSearch

    XCTAssertEqual(model.results.count, 1)
    XCTAssertEqual(model.results[0].id, "fast-result")
  }

  private static func makeResultTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "search-result-template",
        "type": "Text",
        "actions": [],
        "title": "{$datum.street}",
        "subtitle": "{$datum.city}",
        "icon": ""
      }
      """

    guard let resultTemplateData = resultTemplateJSON.data(using: .utf8) else {
      return nil
    }

    return try? JSONDecoder().decode(UI_Row.self, from: resultTemplateData)
  }
}
