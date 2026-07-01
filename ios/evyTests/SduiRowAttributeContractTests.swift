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

  func testEveryRowStructMatchesSchemaAttributes() throws {
    let catalogData = try XCTUnwrap(
      SduiDefinitions.json.data(using: .utf8),
      "SduiDefinitions.json must be valid UTF-8"
    )
    let catalog = try XCTUnwrap(
      JSONSerialization.jsonObject(with: catalogData) as? [String: Any],
      "SduiDefinitions.json must be a JSON object"
    )

    for (rowType, decoder) in SduiRowViewDataRegistry.decoders {
      let schemaDef = try XCTUnwrap(
        catalog[rowType] as? [String: Any],
        "\(rowType): missing schema definition in SduiDefinitions.json"
      )

      let expectedAttributes = extractExpectedAttributes(from: schemaDef, rowType: rowType)
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
    let catalogData = try XCTUnwrap(
      SduiDefinitions.json.data(using: .utf8),
      "SduiDefinitions.json must be valid UTF-8"
    )
    let catalog = try XCTUnwrap(
      JSONSerialization.jsonObject(with: catalogData) as? [String: Any],
      "SduiDefinitions.json must be a JSON object"
    )

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
      "actions": [] as [Any],
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

  private func extractExpectedAttributes(
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
