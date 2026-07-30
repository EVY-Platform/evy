//
//  EVYSearchModelTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYSearchModelTests: XCTestCase {
  override func setUp() async throws {
    try await super.setUp()
    installHermeticMutationSync()
  }

  override func tearDown() async throws {
    resetHermeticMutationSync()
    try await super.tearDown()
  }

  private final class SearchRequestingSpy: EVYSearchRequesting, @unchecked Sendable {
    private(set) var inputs: [String] = []
    var response: EVYJson = .array([])
    var shouldThrow = false
    /// When true, `search(input:)` suspends until `openGate()` is called, letting tests
    /// observe in-flight state before the response resolves. Off by default so existing
    /// tests that call `search` synchronously are unaffected.
    var gatesRequests = false

    private var gate: CheckedContinuation<Void, Never>?

    func openGate() {
      gate?.resume()
      gate = nil
    }

    func search(input: String) async throws -> EVYJson {
      inputs.append(input)
      if gatesRequests {
        await withCheckedContinuation { continuation in
          gate = continuation
        }
      }
      if shouldThrow {
        throw URLError(.badServerResponse)
      }
      return response
    }
  }

  func testSearchCallsRequesterOnceAndPopulatesResults() async {
    let spy = SearchRequestingSpy()
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

    XCTAssertEqual(spy.inputs.count, 1)
    XCTAssertEqual(spy.inputs[0], "Sydney")
    XCTAssertEqual(model.results.count, 1)
    XCTAssertEqual(model.results[0].id, "place-1")
  }

  func testClearResultsEmptiesResults() async {
    let spy = SearchRequestingSpy()
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

  func testIsSearchingIsTrueWhileRequestIsInFlight() async {
    let spy = SearchRequestingSpy()
    spy.gatesRequests = true
    let resultTemplate = Self.makeResultTemplate()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: resultTemplate,
      scopeId: nil,
      requester: spy
    )

    XCTAssertFalse(model.isSearching)

    let searchTask = Task { await model.search(query: "Sydney") }

    while spy.inputs.isEmpty {
      await Task.yield()
    }
    XCTAssertTrue(model.isSearching)

    spy.openGate()
    await searchTask.value

    XCTAssertFalse(model.isSearching)
  }

  func testHasSearchedBecomesTrueAfterAnEmptyResponse() async {
    let spy = SearchRequestingSpy()
    spy.gatesRequests = true
    let resultTemplate = Self.makeResultTemplate()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: resultTemplate,
      scopeId: nil,
      requester: spy
    )
    spy.response = .array([])

    XCTAssertFalse(model.hasSearched)

    let searchTask = Task { await model.search(query: "Nowhere") }
    while spy.inputs.isEmpty {
      await Task.yield()
    }
    spy.openGate()
    await searchTask.value

    XCTAssertTrue(model.results.isEmpty)
    XCTAssertTrue(model.hasSearched)
  }

  func testHasSearchedBecomesTrueAfterAFailedRequest() async {
    let spy = SearchRequestingSpy()
    spy.shouldThrow = true
    spy.gatesRequests = true
    let resultTemplate = Self.makeResultTemplate()
    let model = EVYSearchModel(
      method: "place_search",
      resultTemplate: resultTemplate,
      scopeId: nil,
      requester: spy
    )

    let searchTask = Task { await model.search(query: "Nowhere") }
    while spy.inputs.isEmpty {
      await Task.yield()
    }
    spy.openGate()
    await searchTask.value

    XCTAssertTrue(model.results.isEmpty)
    XCTAssertTrue(model.hasSearched)
    XCTAssertFalse(model.isSearching)
  }

  func testClearResultsResetsSearchState() async {
    let spy = SearchRequestingSpy()
    spy.gatesRequests = true
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

    let searchTask = Task { await model.search(query: "Sydney") }
    while spy.inputs.isEmpty {
      await Task.yield()
    }
    spy.openGate()
    await searchTask.value

    XCTAssertTrue(model.hasSearched)

    model.clearResults()

    XCTAssertTrue(model.results.isEmpty)
    XCTAssertFalse(model.hasSearched)
    XCTAssertFalse(model.isSearching)
  }

  func testLoadLocalResultsRefreshWhenMessageResourceChanges() throws {
    let resource = EVYCoreResource.messages.rawValue
    let pendingId = UUID().uuidString
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    try? EVY.privateStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    let message = EVYTestMessageFixtures.message(
      id: pendingId,
      type: "pickup",
      value: "pending",
      time: "2026-06-03T09:00:00"
    )
    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([message])
    )
    defer {
      try? EVY.publicStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
      try? EVY.privateStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    }

    let template = Self.makeMessageValueTemplate()
    let source = "{\(resource)}"
    let state = EVYState(
      textToWatch: source,
      setter: {
        EVYSearchResult.loadLocalResults(
          source: source,
          resultTemplate: template,
          scopeId: nil
        )
      }
    )

    XCTAssertEqual(state.value.first?.displayRow.subtitle, "pending")

    // An update filter matches flat record keys, so the request is named by id; the
    // change reaches into `data` through a dotted path, which `applyChanges` does support.
    try EVY.update(
      namespace: EVYNamespace.evy,
      resource: resource,
      matching: ["id": .string(pendingId)],
      changes: ["data.value": .string("accept")]
    )

    XCTAssertEqual(state.value.first?.displayRow.subtitle, "accept")
  }

  /// Filtering open requests belongs in the Search `source` expression (`filter`/`owns`),
  /// not in the loader — so a raw `{messages}` source still returns every stored message.
  func testLoadLocalResultsReturnsSourceUnfiltered() throws {
    let resource = EVYCoreResource.messages.rawValue
    let openRequestId = UUID().uuidString.lowercased()
    let settledRequestId = UUID().uuidString.lowercased()
    let responseId = UUID().uuidString.lowercased()
    let itemId = UUID().uuidString.lowercased()
    let service = UUID().uuidString.lowercased()
    let itemResource = UUID().uuidString.lowercased()
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    try? EVY.privateStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    defer {
      try? EVY.publicStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
      try? EVY.privateStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    }

    try EVY.applySyncedValue(
      namespace: EVYNamespace.evy,
      resource: resource,
      value: .array([
        EVYTestMessageFixtures.request(
          id: openRequestId, fk: itemId, service: service, resource: itemResource),
        EVYTestMessageFixtures.request(
          id: settledRequestId, fk: itemId, service: service, resource: itemResource,
          type: "delivery"),
        EVYTestMessageFixtures.response(
          id: responseId,
          to: settledRequestId,
          fk: itemId,
          service: service,
          resource: itemResource,
          value: "accept",
          type: "delivery"
        ),
      ])
    )

    let results = EVYSearchResult.loadLocalResults(
      source: "{\(resource)}",
      resultTemplate: Self.makeMessageValueTemplate(),
      scopeId: nil
    )

    XCTAssertEqual(
      Set(results.map(\.id)),
      Set([openRequestId, settledRequestId, responseId]),
      "the loader no longer filters messages; source expressions do")
  }

  private static func makeMessageValueTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "message-status-template",
        "type": "text",
        "actions": {},
        "title": "{$datum.data.type} request",
        "subtitle": "{$datum.data.value}",
        "visible": "true",
        "name": "Message"
      }
      """
    guard let resultTemplateData = resultTemplateJSON.data(using: .utf8) else {
      return nil
    }
    return try? JSONDecoder().decode(UI_Row.self, from: resultTemplateData)
  }

  private static func makeListItemTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "search-list-item-template",
        "type": "list_item",
        "actions": {},
        "title": "{$datum.title}",
        "subtitle": "",
        "image": ""
      }
      """
    guard let resultTemplateData = resultTemplateJSON.data(using: .utf8) else {
      return nil
    }
    return try? JSONDecoder().decode(UI_Row.self, from: resultTemplateData)
  }

  private static func makeResultTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "search-result-template",
        "type": "text",
        "actions": {},
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
