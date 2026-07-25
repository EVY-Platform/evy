//
//  SduiRowAttributeContractTests.swift
//  evyTests
//

import XCTest

@testable import evy

private let baseFieldNames: Set<String> = [
  "type", "actions", "visible", "name", "id",
]

final class SduiRowAttributeContractTests: XCTestCase {

  private func loadCatalog() throws -> [String: Any] {
    let catalogData = try XCTUnwrap(
      SduiDefinitions.json.data(using: .utf8),
      "SduiDefinitions.json must be valid UTF-8"
    )
    return try XCTUnwrap(
      JSONSerialization.jsonObject(with: catalogData) as? [String: Any],
      "SduiDefinitions.json must be a JSON object"
    )
  }

  private static func rowTypesWithInitialAttribute(from catalog: [String: Any]) -> Set<String> {
    var rowTypes = Set<String>()
    for (rowType, schemaDef) in catalog {
      guard let schemaDefDict = schemaDef as? [String: Any] else { continue }
      let attributes = Self.extractExpectedAttributes(from: schemaDefDict, rowType: rowType)
      if attributes["initial"] != nil {
        rowTypes.insert(rowType)
      }
    }
    return rowTypes
  }

  func testInitialAttributePresentAndOptionalOnlyForSupportedRows() throws {
    let catalog = try loadCatalog()
    let supportedInitialRowTypes = Self.rowTypesWithInitialAttribute(from: catalog)

    for (rowType, schemaDef) in catalog {
      let schemaDefDict = try XCTUnwrap(
        schemaDef as? [String: Any],
        "\(rowType): schema definition must be a JSON object"
      )
      let expectedAttributes = Self.extractExpectedAttributes(from: schemaDefDict, rowType: rowType)
      let hasInitial = expectedAttributes["initial"] != nil
      let isOptional = expectedAttributes["initial"] ?? false

      if supportedInitialRowTypes.contains(rowType) {
        XCTAssertTrue(
          hasInitial,
          "\(rowType): expected optional `initial` attribute in schema"
        )
        XCTAssertTrue(
          isOptional,
          "\(rowType): `initial` must be optional (not in required)"
        )
      } else {
        XCTAssertFalse(
          hasInitial,
          "\(rowType): must not declare `initial` — only Dropdown, Input, TextArea, and InlinePicker support it"
        )
      }
    }
  }

  func testSwipeLabelPresentAndOptionalOnlyForSwipeLeftRows() throws {
    let catalog = try loadCatalog()
    let supportedSwipeLabelRowTypes: Set<String> = [
      "Heading", "Input", "ListItem", "Text",
    ]

    for (rowType, schemaDef) in catalog {
      let schemaDefDict = try XCTUnwrap(
        schemaDef as? [String: Any],
        "\(rowType): schema definition must be a JSON object"
      )
      let expectedAttributes = Self.extractExpectedAttributes(from: schemaDefDict, rowType: rowType)
      let hasSwipeLabel = expectedAttributes["swipeLabel"] != nil
      let isOptional = expectedAttributes["swipeLabel"] ?? false

      if supportedSwipeLabelRowTypes.contains(rowType) {
        XCTAssertTrue(
          hasSwipeLabel,
          "\(rowType): expected optional `swipeLabel` attribute in schema"
        )
        XCTAssertTrue(
          isOptional,
          "\(rowType): `swipeLabel` must be optional (not in required)"
        )
      } else {
        XCTAssertFalse(
          hasSwipeLabel,
          "\(rowType): must not declare `swipeLabel` — only Heading, Input, ListItem, and Text support it"
        )
      }
    }
  }

  func testUIRowDecodesTriggerKeyedActions() throws {
    let rowData = try JSONSerialization.data(
      withJSONObject: [
        "id": "actions-shape-row",
        "type": "Button",
        "visible": "true",
        "actions": [
          "tap": [
            [
              "condition": "",
              "false": "",
              "true": "{close()}",
            ]
          ]
        ],
      ])
    let row = try JSONDecoder().decode(UI_Row.self, from: rowData)
    XCTAssertEqual(row.actions.tap.count, 1)
    XCTAssertEqual(row.actions.tap.first?.true, .legacy("{close()}"))
    XCTAssertTrue(row.actions.delete.isEmpty)
  }

  /// The dual-read window: a row may store either branch form, and both must
  /// decode. A structured branch failing to decode would make the whole row
  /// vanish, which is the failure this migration exists to remove.
  func testRowDecodesStructuredActionBranches() throws {
    let rowData = try JSONSerialization.data(
      withJSONObject: [
        "id": "ast-actions-row",
        "type": "Button",
        "visible": "true",
        "actions": [
          "tap": [
            [
              "condition": "",
              "false": ["fn": "close"],
              "true": [
                "fn": "create",
                "service": "svc",
                "resource": "items",
                "mode": "submit",
              ],
            ]
          ]
        ],
      ])

    let row = try JSONDecoder().decode(UI_Row.self, from: rowData)
    XCTAssertEqual(
      row.actions.tap.first?.true,
      .invocation(.create(service: "svc", resource: "items", mode: .submit, idDestination: nil)))
    XCTAssertEqual(row.actions.tap.first?.false, .invocation(.close))
  }

  func testStructuredBranchesRoundTripThroughCoding() throws {
    let branches: [EVYActionBranch] = [
      .legacy("{close()}"),
      .invocation(.show(rowId: "row-1")),
      .invocation(.navigate(flowId: "f", pageId: "p", query: ["id": "$datum.id"])),
      .invocation(
        .create(
          service: "s", resource: "r", mode: .inline(data: ["a": "b"]),
          idDestination: "{buf.id}")),
      .invocation(
        .update(
          service: "s", resource: "r", mode: .store, filter: ["id": "x"],
          changes: .literal(["a": "b"]))),
      .invocation(
        .update(
          service: "s", resource: "r", mode: .draft, filter: [:],
          changes: .path("buf"))),
    ]

    for branch in branches {
      let encoded = try JSONEncoder().encode(branch)
      let decoded = try JSONDecoder().decode(EVYActionBranch.self, from: encoded)
      XCTAssertEqual(decoded, branch)
    }
  }

  func testSduiDefinitionsIncludeTriggersMetadata() throws {
    let allowedTriggers: Set<String> = [
      "tap", "delete", "tap-row", "tap-column", "swipe-left", "submit",
    ]
    let catalog = try loadCatalog()
    for (rowType, schemaDef) in catalog {
      let schemaDefDict = try XCTUnwrap(
        schemaDef as? [String: Any],
        "\(rowType): schema definition must be a JSON object"
      )
      let triggers = try XCTUnwrap(
        schemaDefDict["triggers"] as? [String: String],
        "\(rowType): must declare triggers metadata"
      )
      XCTAssertFalse(triggers.isEmpty, "\(rowType): triggers must not be empty")
      for (triggerName, requirement) in triggers {
        XCTAssertTrue(
          allowedTriggers.contains(triggerName),
          "\(rowType): unknown trigger \(triggerName)"
        )
        XCTAssertTrue(
          requirement == "required" || requirement == "optional",
          "\(rowType): invalid requirement for \(triggerName)"
        )
      }
    }
    let selectPhotoTriggers = try XCTUnwrap(
      (catalog["SelectPhoto"] as? [String: Any])?["triggers"] as? [String: String]
    )
    XCTAssertEqual(selectPhotoTriggers["tap"], "required")
    XCTAssertEqual(selectPhotoTriggers["delete"], "required")
    let calendarTriggers = try XCTUnwrap(
      (catalog["Calendar"] as? [String: Any])?["triggers"] as? [String: String]
    )
    XCTAssertEqual(calendarTriggers["tap"], "required")
    XCTAssertEqual(calendarTriggers["tap-row"], "required")
    XCTAssertEqual(calendarTriggers["tap-column"], "required")
    let inputTriggers = try XCTUnwrap(
      (catalog["Input"] as? [String: Any])?["triggers"] as? [String: String]
    )
    XCTAssertEqual(inputTriggers["tap"], "optional")
    XCTAssertEqual(inputTriggers["submit"], "optional")
    XCTAssertEqual(inputTriggers["swipe-left"], "optional")
    let textAreaTriggers = try XCTUnwrap(
      (catalog["TextArea"] as? [String: Any])?["triggers"] as? [String: String]
    )
    XCTAssertEqual(textAreaTriggers["tap"], "optional")
    XCTAssertEqual(textAreaTriggers["submit"], "optional")
    let searchTriggers = try XCTUnwrap(
      (catalog["Search"] as? [String: Any])?["triggers"] as? [String: String]
    )
    XCTAssertEqual(searchTriggers["tap"], "optional")
    XCTAssertNil(searchTriggers["submit"])
  }

  func testUIRowDecodesOptionalSheetForEveryRowType() throws {
    for rowType in SduiRowViewDataRegistry.decoders.keys.sorted() {
      let rowJson: [String: Any] = [
        "id": "sheet-contract-row",
        "type": rowType,
        "visible": "true",
        "actions": [:] as [String: Any],
        "sheet": [
          "id": "nested-sheet",
          "type": "Text",
          "visible": "true",
          "actions": [:] as [String: Any],
          "title": "Sheet",
        ],
      ]
      let rowData = try JSONSerialization.data(withJSONObject: rowJson)
      let row = try JSONDecoder().decode(UI_Row.self, from: rowData)
      XCTAssertEqual(row.sheet?.id, "nested-sheet", "\(rowType) must decode optional sheet")
    }
  }

  func testSearchRowViewDataExposesChildOnlyAmongRowPayloads() {
    let searchAttributes = reflectAttributes(
      SearchRowViewData(
        title: nil,
        source: "{items}",
        destination: "{query}",
        placeholder: nil,
        child: nil
      )
    )
    XCTAssertNotNil(searchAttributes["child"])

    let buttonAttributes = reflectAttributes(ButtonRowViewData(title: nil, label: "Go", style: nil))
    XCTAssertNil(buttonAttributes["child"])
  }

  func testOnlySearchSchemaDeclaresChildRelationship() throws {
    let catalog = try loadCatalog()

    for (rowType, schemaDef) in catalog {
      let schemaDefDict = try XCTUnwrap(schemaDef as? [String: Any])
      let attributes = Self.extractExpectedAttributes(from: schemaDefDict, rowType: rowType)
      if rowType == "Search" {
        XCTAssertNotNil(attributes["child"])
      } else {
        XCTAssertNil(attributes["child"], "\(rowType) must not declare child in schema")
      }
    }
  }

  func testEveryRowStructMatchesSchemaAttributes() throws {
    let catalog = try loadCatalog()

    for (rowType, decoder) in SduiRowViewDataRegistry.decoders {
      let schemaDef = try XCTUnwrap(
        catalog[rowType] as? [String: Any],
        "\(rowType): missing schema definition in SduiDefinitions.json"
      )

      let expectedAttributes = Self.extractExpectedAttributes(from: schemaDef, rowType: rowType)
      XCTAssertFalse(
        expectedAttributes.isEmpty,
        "\(rowType): no attributes found in schema — check allOf structure"
      )

      let minimalPayload = buildMinimalPayload(from: schemaDef)
      let payloadData = try JSONSerialization.data(withJSONObject: minimalPayload)
      let instance = try decoder(payloadData)
      let actualAttributes = reflectAttributes(instance)

      let missing = Set(expectedAttributes.keys).subtracting(actualAttributes.keys)
      let extra = Set(actualAttributes.keys).subtracting(expectedAttributes.keys)

      XCTAssertTrue(
        missing.isEmpty,
        "\(rowType): schema attributes missing from struct: \(missing.sorted().joined(separator: ", "))"
      )
      XCTAssertTrue(
        extra.isEmpty,
        "\(rowType): struct has attributes not in schema: \(extra.sorted().joined(separator: ", "))"
      )

      for (name, expectedIsOptional) in expectedAttributes {
        guard let actualIsOptional = actualAttributes[name] else { continue }
        XCTAssertEqual(
          actualIsOptional, expectedIsOptional,
          "\(rowType).\(name): schema isOptional=\(expectedIsOptional) but struct isOptional=\(actualIsOptional)"
        )
      }
    }
  }

  func testRowPayloadDestinationMatchesSchemaBindingFields() throws {
    let catalog = try loadCatalog()

    for rowType in catalog.keys.sorted() {
      let schemaDef = try XCTUnwrap(
        catalog[rowType] as? [String: Any],
        "\(rowType): missing schema definition in SduiDefinitions.json"
      )
      guard schemaHasBindingField(schemaDef, field: "destination") else { continue }

      var rowJson = buildMinimalRowJson(from: schemaDef, rowType: rowType)
      rowJson["destination"] = "draft.target"
      let rowData = try JSONSerialization.data(withJSONObject: rowJson)
      let row = try JSONDecoder().decode(UI_Row.self, from: rowData)
      let payload = try UI_RowPayload.from(row: row)

      XCTAssertEqual(
        payload.destination,
        "draft.target",
        "\(rowType): UI_RowPayload.destination must match row destination"
      )
    }
  }

  private func schemaHasBindingField(
    _ schemaDef: [String: Any],
    field: String
  ) -> Bool {
    guard let allOf = schemaDef["allOf"] as? [[String: Any]] else { return false }
    for body in allOf {
      guard let properties = body["properties"] as? [String: Any] else { continue }
      return properties[field] != nil
    }
    return false
  }

  private func buildMinimalRowJson(
    from schemaDef: [String: Any],
    rowType: String
  ) -> [String: Any] {
    var rowJson: [String: Any] = [
      "id": "test-row",
      "type": rowType,
      "visible": "",
      "actions": [:] as [String: Any],
    ]
    for (name, value) in buildMinimalPayload(from: schemaDef) {
      rowJson[name] = value
    }
    return rowJson
  }

  private func buildMinimalPayload(from schemaDef: [String: Any]) -> [String: Any] {
    guard let allOf = schemaDef["allOf"] as? [[String: Any]] else { return [:] }
    for body in allOf {
      guard let properties = body["properties"] as? [String: Any] else { continue }
      let required = Set((body["required"] as? [String]) ?? [])
      var payload: [String: Any] = [:]
      for (name, propSchema) in properties {
        if baseFieldNames.contains(name) { continue }
        guard required.contains(name) else { continue }
        guard let propObj = propSchema as? [String: Any] else { continue }
        if let ref = propObj["$ref"] as? String, ref.hasSuffix("/UI_Row") { continue }
        if propObj["type"] as? String == "array" {
          payload[name] = [] as [Any]
        } else {
          payload[name] = ""
        }
      }
      return payload
    }
    return [:]
  }

  private static func extractExpectedAttributes(
    from schemaDef: [String: Any],
    rowType: String
  ) -> [String: Bool] {
    guard let allOf = schemaDef["allOf"] as? [[String: Any]] else { return [:] }
    for body in allOf {
      guard let properties = body["properties"] as? [String: Any] else { continue }
      let required = Set((body["required"] as? [String]) ?? [])
      var result: [String: Bool] = [:]
      for (name, propSchema) in properties where !baseFieldNames.contains(name) {
        if let propObj = propSchema as? [String: Any],
          let ref = propObj["$ref"] as? String,
          ref.hasSuffix("/UI_Row")
        {
          result[name] = true
        } else {
          result[name] = !required.contains(name)
        }
      }
      return result
    }
    return [:]
  }

  private func reflectAttributes(_ instance: Any) -> [String: Bool] {
    var result: [String: Bool] = [:]
    for child in Mirror(reflecting: instance).children {
      guard let name = child.label else { continue }
      let isOptional = Mirror(reflecting: child.value).displayStyle == .optional
      result[name] = isOptional
    }
    return result
  }
}

@MainActor
final class SduiRowInitialBootstrapTests: XCTestCase {

  override func tearDownWithError() throws {
    EVY.draftStore.deleteDrafts()
    EVY.draftStore.activeScopeId = nil
    if let pageId = EVY.activeCacheScopeId {
      try? EVY.cacheStore.deleteAll(namespace: EVYNamespace.cache, resource: pageId)
    }
    EVY.activeCacheScopeId = nil
    try super.tearDownWithError()
  }

  func testInputWithInitialSeedsScalarDraft() throws {
    try assertSeedsDraft(
      type: "Input", initial: "Default title", expected: .string("Default title"))
  }

  func testTextAreaWithInitialSeedsScalarDraft() throws {
    try assertSeedsDraft(
      type: "TextArea", initial: "Default description",
      expected: .string("Default description"))
  }

  func testDropdownWithInitialSeedsScalarDraft() throws {
    try assertSeedsDraft(
      type: "Dropdown", initial: "condition_new", expected: .string("condition_new"),
      extraFields: ["source": "{options}", "value": "{$datum.value}"]
    )
  }

  func testInlinePickerWithInitialSeedsArrayDraft() throws {
    try assertSeedsDraft(
      type: "InlinePicker", initial: "distance_10",
      expected: .array([.string("distance_10")]),
      extraFields: ["source": "{options}", "value": "{$datum.value}"]
    )
  }

  private func assertSeedsDraft(
    type: String,
    initial: String,
    expected: EVYJson,
    extraFields: [String: String] = [:],
    file: StaticString = #file,
    line: UInt = #line
  ) throws {
    let key = uniqueKey("\(type.lowercased())_initial")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId

    let row = try makeRow(
      type: type, destination: "{\(key)}", initial: initial, extraFields: extraFields)
    bootstrapRowDraft(row: row, scopeId: scopeId)

    XCTAssertEqual(
      try EVY.getDataFromText("{\(key)}"), expected, file: file, line: line)
  }

  func testRowsWithoutInitialKeepEmptyBootstrap() throws {
    let inputKey = uniqueKey("input_no_initial")
    let inlinePickerKey = uniqueKey("inlinepicker_no_initial")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId

    let inputRow = try makeRow(
      type: "Input", destination: "{\(inputKey)}", initial: "",
      extraFields: ["source": "{\(inputKey)}"]
    )
    bootstrapRowDraft(row: inputRow, scopeId: scopeId)
    XCTAssertEqual(try EVY.getDataFromText("{\(inputKey)}"), .string(""))

    let inlinePickerRow = try makeRow(
      type: "InlinePicker", destination: "{\(inlinePickerKey)}", initial: "",
      extraFields: ["source": "{options}", "value": "{$datum.value}"]
    )
    bootstrapRowDraft(row: inlinePickerRow, scopeId: scopeId)
    XCTAssertEqual(try EVY.getDataFromText("{\(inlinePickerKey)}"), .array([]))
  }

  func testExistingDraftIsNotOverwrittenByInitial() throws {
    let key = uniqueKey("existing_draft")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId

    try EVY.writeRawStringValue("User edit", to: "{\(key)}", scopeId: scopeId)

    let row = try makeRow(type: "Input", destination: "{\(key)}", initial: "Ignored default")
    bootstrapRowDraft(row: row, scopeId: scopeId)

    XCTAssertEqual(try EVY.getDataFromText("{\(key)}"), .string("User edit"))
  }

  func testConcreteCacheDataIsNotShadowedByInitialDraft() throws {
    let entityId = UUID().uuidString
    let pageId = "page_\(UUID().uuidString)"
    let scopeId = "flow:items"
    EVY.activeCacheScopeId = pageId
    EVY.draftStore.activeScopeId = scopeId

    let entity = EVYJson.dictionary([
      "id": .string(entityId),
      "title": .string("Existing title"),
    ])
    try EVY.cacheStore.create(
      namespace: EVYNamespace.cache, resource: pageId, id: entityId,
      value: try JSONEncoder().encode(entity)
    )

    let row = try makeRow(
      type: "Input", destination: "{\(entityId).title}", initial: "Ignored default",
      extraFields: ["source": "{\(entityId).title}"]
    )
    bootstrapRowDraft(row: row, scopeId: scopeId)

    let drafts = try EVY.draftStore.drafts(forScopeId: scopeId)
    XCTAssertTrue(drafts.isEmpty, "No draft should be created when concrete data already exists")
    XCTAssertEqual(try EVY.getDataFromText("{\(entityId).title}"), .string("Existing title"))
  }

  func testBuildCurrencyInitialProducesSameShapeAsExplicitEdit() throws {
    let priceKey = uniqueKey("build_currency_price")
    let scopeId = "scope_\(UUID().uuidString)"
    EVY.draftStore.activeScopeId = scopeId

    let initialRow = try makeRow(
      type: "Input", destination: "{buildCurrency(\(priceKey))}", initial: "0",
      extraFields: ["source": "{formatCurrency(\(priceKey))}"]
    )
    bootstrapRowDraft(row: initialRow, scopeId: scopeId)
    let seededValue = try EVY.getDataFromText("{\(priceKey)}")

    EVY.draftStore.deleteDrafts()

    let editRow = try makeRow(
      type: "Input", destination: "{buildCurrency(\(priceKey))}", initial: "",
      extraFields: ["source": "{formatCurrency(\(priceKey))}"]
    )
    bootstrapRowDraft(row: editRow, scopeId: scopeId)
    try EVY.writeRawStringValue("0", to: "{buildCurrency(\(priceKey))}", scopeId: scopeId)
    let editedValue = try EVY.getDataFromText("{\(priceKey)}")

    XCTAssertEqual(seededValue, editedValue)
    guard case .dictionary(let dict) = seededValue else {
      XCTFail("Expected dictionary from buildCurrency")
      return
    }
    XCTAssertEqual(dict["currency"], .string("AUD"))
    XCTAssertEqual(dict["value"], .int(0))
  }

  private func makeRow(
    type: String,
    destination: String,
    initial: String,
    extraFields: [String: String] = [:]
  ) throws -> UI_Row {
    var rowJson: [String: Any] = [
      "id": "test-row-\(UUID().uuidString)",
      "type": type,
      "visible": "true",
      "actions": [:] as [String: Any],
      "title": "",
      "name": "test row",
      "destination": destination,
    ]
    if !initial.isEmpty {
      rowJson["initial"] = initial
    }
    for (key, value) in extraFields {
      rowJson[key] = value
    }
    let rowData = try JSONSerialization.data(withJSONObject: rowJson)
    return try JSONDecoder().decode(UI_Row.self, from: rowData)
  }
}
