//
//  EVYContainerDynamicChildrenTests.swift
//  evyTests
//

import XCTest

@testable import evy

@MainActor
final class EVYContainerDynamicChildrenTests: XCTestCase {
  private var testPageId = ""

  override func setUpWithError() throws {
    try super.setUpWithError()
    testPageId = "dynamic_children_\(UUID().uuidString)"
    EVY.activeCacheScopeId = testPageId
  }

  override func tearDownWithError() throws {
    try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: testPageId)
    EVY.activeCacheScopeId = nil
    try super.tearDownWithError()
  }

  func testInstancesInterpolateOneRowPerDatumBeforeStaticChildrenOrderIsPreservedInTabLabels()
    throws
  {
    let itemsKey = "fixture_items"
    try store(
      .array([
        .dictionary(["title": .string("Alpha")]),
        .dictionary(["title": .string("Beta")]),
      ]),
      at: itemsKey
    )

    let templateJson = """
      {
        "id": "template-row",
        "type": "Text",
        "actions": [],
        "visible": "true",
        "title": "{$datum.title}",
        "subtitle": "",
        "icon": ""
      }
      """
    let templateData = templateJson.data(using: .utf8)!
    let templateRow = try JSONDecoder().decode(UI_Row.self, from: templateData)

    let instances = EVYContainerDynamicChildren.instances(
      source: "{\(itemsKey)}",
      childRef: .inline(templateRow),
      scopeId: testPageId
    )

    XCTAssertEqual(instances.count, 2)
    XCTAssertEqual(instances[0].displayRow.title, "Alpha")
    XCTAssertEqual(instances[1].displayRow.title, "Beta")

    let tabs = EVYTabContainerTabs.build(
      source: "{\(itemsKey)}",
      childRef: .inline(templateRow),
      staticSegments: ["Static"],
      staticChildRefs: [.inline(templateRow)],
      scopeId: testPageId
    )

    XCTAssertEqual(tabs.count, 3)
    XCTAssertEqual(tabs[0].label, "Alpha")
    XCTAssertEqual(tabs[1].label, "Beta")
    XCTAssertEqual(tabs[2].label, "Static")
  }

  private func store(_ value: EVYJson, at key: String) throws {
    let encodedValue = try JSONEncoder().encode(value)
    try EVY.publicStore.create(
      namespace: EVYNamespace.local, resource: key, id: EVYNamespace.singletonId,
      value: encodedValue)
  }
}
