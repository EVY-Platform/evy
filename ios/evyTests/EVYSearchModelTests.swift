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
    try evySeedStandardFormattersForTests()
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
      resultTemplates: [resultTemplate].compactMap { $0 },
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
      resultTemplates: [resultTemplate].compactMap { $0 },
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
      resultTemplates: [resultTemplate].compactMap { $0 },
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
      resultTemplates: [resultTemplate].compactMap { $0 },
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
      resultTemplates: [resultTemplate].compactMap { $0 },
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
      resultTemplates: [resultTemplate].compactMap { $0 },
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
    let resource = EVYCoreResource.messages.ref
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
          resultTemplates: [template].compactMap { $0 },
          scopeId: nil
        )
      }
    )

    XCTAssertEqual(state.value.first?.displayRow.subtitle, "pending")

    // An update filter matches flat record keys, so the request is named by id; the
    // change reaches into `value` at the message root.
    try EVY.update(
      namespace: EVYNamespace.evy,
      resource: resource,
      matching: ["id": .string(pendingId)],
      changes: ["value": .string("accept")]
    )

    XCTAssertEqual(state.value.first?.displayRow.subtitle, "accept")
  }

  /// The result template is a pure input: passing an edited template must
  /// produce differently-formatted results. (The view layer re-inits EVYSearch
  /// via an identity reset when the child template record changes.)
  func testLoadLocalResultsReflectsAnEditedResultTemplate() throws {
    let resource = EVYCoreResource.messages.ref
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    try? EVY.privateStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    let message = EVYTestMessageFixtures.message(
      id: UUID().uuidString,
      type: "pickup",
      value: "pending"
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

    func template(titled title: String) -> UI_Row? {
      let json = """
        {
          "id": "message-status-template",
          "type": "text",
          "actions": {},
          "title": "\(title)",
          "subtitle": "{$datum.value}",
          "visible": "true",
          "name": "Message"
        }
        """
      guard let data = json.data(using: .utf8) else { return nil }
      return try? JSONDecoder().decode(UI_Row.self, from: data)
    }

    let source = "{\(resource)}"
    let before = EVYSearchResult.loadLocalResults(
      source: source,
      resultTemplates: [template(titled: "{$datum.type} request")].compactMap { $0 },
      scopeId: nil
    )
    let after = EVYSearchResult.loadLocalResults(
      source: source,
      resultTemplates: [template(titled: "{$datum.type} — {$datum.value}")].compactMap { $0 },
      scopeId: nil
    )

    XCTAssertEqual(before.first?.displayRow.title, "pickup request")
    XCTAssertEqual(after.first?.displayRow.title, "pickup — pending")
  }

  /// Filtering open requests belongs in the Search `source` expression (`filter`/`owns`),
  /// not in the loader — so a raw `{messages}` source still returns every stored message.
  func testLoadLocalResultsReturnsSourceUnfiltered() throws {
    let resource = EVYCoreResource.messages.ref
    let openRequestId = UUID().uuidString.lowercased()
    let settledRequestId = UUID().uuidString.lowercased()
    let responseId = UUID().uuidString.lowercased()
    let itemId = UUID().uuidString.lowercased()
    let itemResourceSlug = UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "_")
    let itemResource = "test_svc.\(itemResourceSlug)"
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
          id: openRequestId, fk: itemId, resource: itemResource),
        EVYTestMessageFixtures.request(
          id: settledRequestId, fk: itemId, resource: itemResource,
          type: "delivery"),
        EVYTestMessageFixtures.response(
          id: responseId,
          to: settledRequestId,
          fk: itemId,
          resource: itemResource,
          value: "accept",
          type: "delivery"
        ),
      ])
    )

    let results = EVYSearchResult.loadLocalResults(
      source: "{\(resource)}",
      resultTemplates: [Self.makeMessageValueTemplate()].compactMap { $0 },
      scopeId: nil
    )

    XCTAssertEqual(
      Set(results.map(\.id)),
      Set([openRequestId, settledRequestId, responseId]),
      "the loader no longer filters messages; source expressions do")
  }

  func testLoadLocalResultsFormatsDestinationAddressSubtitle() throws {
    let resource = EVYCoreResource.messages.ref
    let requestId = UUID().uuidString
    try? EVY.publicStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    try? EVY.privateStore.deleteAll(namespace: EVYNamespace.evy, resource: resource)
    let destination = EVYJson.dictionary([
      "unit": .string("C509"),
      "street": .string("28 Rothschild Avenue"),
      "city": .string("Rosebery"),
      "postcode": .string("2018"),
      "state": .string("NSW"),
      "country": .string("Australia"),
    ])
    let message = EVYTestMessageFixtures.message(
      id: requestId,
      type: "delivery",
      value: "pending",
      time: "2026-06-04T10:00:00",
      destination_address: destination
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

    let template = Self.makeDestinationSubtitleTemplate()
    let source = "{\(resource)}"
    let state = EVYState(
      textToWatch: source,
      setter: {
        EVYSearchResult.loadLocalResults(
          source: source,
          resultTemplates: [template].compactMap { $0 },
          scopeId: nil
        )
      }
    )

    XCTAssertEqual(
      state.value.first?.displayRow.subtitle,
      "C509 28 Rothschild Avenue, 2018 Rosebery NSW")
  }

  func testVariantSelectionPicksFirstMatchingTemplate() throws {
    let pendingId = UUID().uuidString
    let acceptId = UUID().uuidString
    let sourceData = EVYJson.array([
      EVYTestMessageFixtures.message(id: pendingId, type: "pickup", value: "pending"),
      EVYTestMessageFixtures.message(id: acceptId, type: "pickup", value: "accept"),
    ])
    let pendingTemplate = Self.makeVariantTemplate(
      id: "pending-variant",
      swipeLabel: "Accept",
      visible: "{$datum.value == \"pending\"}"
    )
    let catchAllTemplate = Self.makeVariantTemplate(
      id: "catch-all-variant",
      swipeLabel: "Done",
      visible: "true"
    )

    let results = EVYSearchResult.makeResults(
      from: sourceData,
      resultTemplates: [pendingTemplate, catchAllTemplate].compactMap { $0 },
      scopeId: nil
    )

    XCTAssertEqual(results.count, 2)
    let pendingResult = try XCTUnwrap(results.first { $0.id == pendingId })
    let acceptResult = try XCTUnwrap(results.first { $0.id == acceptId })
    XCTAssertEqual(pendingResult.displayRow.swipe_label, "Accept")
    XCTAssertEqual(acceptResult.displayRow.swipe_label, "Done")
  }

  func testVariantSelectionSkipsDatumWithNoMatch() throws {
    let message = EVYTestMessageFixtures.message(
      id: UUID().uuidString,
      type: "pickup",
      value: "pending"
    )
    let template = Self.makeVariantTemplate(
      id: "non-matching-variant",
      swipeLabel: "Accept",
      visible: "{$datum.value == \"accept\"}"
    )

    let results = EVYSearchResult.makeResults(
      from: .array([message]),
      resultTemplates: [template].compactMap { $0 },
      scopeId: nil
    )

    XCTAssertTrue(results.isEmpty)
  }

  func testSingleChildStillRenders() throws {
    let messageId = UUID().uuidString
    let message = EVYTestMessageFixtures.message(
      id: messageId,
      type: "pickup",
      value: "pending"
    )
    let template = Self.makeMessageValueTemplate()

    let results = EVYSearchResult.makeResults(
      from: .array([message]),
      resultTemplates: [template].compactMap { $0 },
      scopeId: nil
    )

    XCTAssertEqual(results.count, 1)
    XCTAssertEqual(results.first?.displayRow.title, "pickup request")
  }

  func testVariantWhenDoesNotLeakIntoRenderedVisible() throws {
    let message = EVYTestMessageFixtures.message(
      id: UUID().uuidString,
      type: "pickup",
      value: "pending"
    )
    let template = Self.makeVariantTemplate(
      id: "pending-variant",
      swipeLabel: "Accept",
      visible: "{$datum.value == \"pending\"}"
    )

    let results = EVYSearchResult.makeResults(
      from: .array([message]),
      resultTemplates: [template].compactMap { $0 },
      scopeId: nil
    )
    let displayRow = try XCTUnwrap(results.first?.displayRow)

    XCTAssertEqual(displayRow.visible.trimmingCharacters(in: .whitespacesAndNewlines), "true")
  }

  private static func makeVariantTemplate(
    id: String,
    swipeLabel: String,
    visible: String
  ) -> UI_Row? {
    let rowJson: [String: Any] = [
      "id": id,
      "type": "list_item",
      "actions": [:] as [String: Any],
      "title": "{$datum.type} request",
      "subtitle": "{$datum.value}",
      "visible": visible,
      "swipe_label": swipeLabel,
      "name": "Variant",
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: rowJson) else {
      return nil
    }
    return try? JSONDecoder().decode(UI_Row.self, from: data)
  }

  private static func makeDestinationSubtitleTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "message-destination-template",
        "type": "text",
        "actions": {},
        "title": "{$datum.type} request",
        "subtitle": "{if(length($datum.data.destination_address.street) > 0, formatAddress($datum.data.destination_address), $datum.value)}",
        "visible": "true",
        "name": "Message"
      }
      """
    guard let resultTemplateData = resultTemplateJSON.data(using: .utf8) else {
      return nil
    }
    return try? JSONDecoder().decode(UI_Row.self, from: resultTemplateData)
  }

  private static func makeMessageValueTemplate() -> UI_Row? {
    let resultTemplateJSON = """
      {
        "id": "message-status-template",
        "type": "text",
        "actions": {},
        "title": "{$datum.type} request",
        "subtitle": "{$datum.value}",
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
