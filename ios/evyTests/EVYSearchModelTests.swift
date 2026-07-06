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
    var onSearch: ((String, String) -> Void)?

    func search(method: String, input: String) async throws -> EVYJson {
      calls.append(Call(method: method, input: input))
      onSearch?(method, input)
      return response
    }
  }

  func testNonWhitespaceInputSchedulesRequestAfterDebounce() async {
    let spy = PlaceSearchRequestingSpy()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: nil,
      scopeId: nil,
      requester: spy
    )

    let expectation = expectation(description: "search called after debounce")
    spy.onSearch = { _, _ in expectation.fulfill() }

    model.queryChanged("hello")
    XCTAssertEqual(spy.calls.count, 0)

    await fulfillment(of: [expectation], timeout: 1.0)
    XCTAssertEqual(spy.calls.count, 1)
    XCTAssertEqual(spy.calls[0].method, "place_search")
    XCTAssertEqual(spy.calls[0].input, "hello")
  }

  func testWhitespaceInputDispatchesImmediately() async {
    let spy = PlaceSearchRequestingSpy()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: nil,
      scopeId: nil,
      requester: spy
    )

    model.queryChanged("hello ")
    await model.awaitInFlightWork()

    XCTAssertEqual(spy.calls.count, 1)
    XCTAssertEqual(spy.calls[0].input, "hello")
  }

  func testEmptyInputClearsResultsAndDispatchesNothing() async {
    let spy = PlaceSearchRequestingSpy()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: nil,
      scopeId: nil,
      requester: spy
    )

    model.queryChanged("   ")
    await model.awaitInFlightWork()

    XCTAssertEqual(spy.calls.count, 0)
    XCTAssertTrue(model.results.isEmpty)
  }

  func testRapidInputsOnlyRequestLatestQuery() async {
    let spy = PlaceSearchRequestingSpy()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: nil,
      scopeId: nil,
      requester: spy
    )

    model.queryChanged("hel")
    model.queryChanged("hell")
    model.queryChanged("hello")
    await model.awaitInFlightWork()

    XCTAssertEqual(spy.calls.count, 1)
    XCTAssertEqual(spy.calls[0].input, "hello")
  }
}
