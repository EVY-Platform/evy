//
//  EVY+Preview.swift
//  evy
//

import SwiftUI

// MARK: - Preview Mock Data

@MainActor
enum EVYPreviewMockData {

  static let item = """
    {
      "id": "preview-item-1",
      "title": "Amazing Fridge",
      "price": 150,
      "description": "A fantastic fridge in great condition",
      "condition": "cond-1",
      "dimensions": {
        "width": 60,
        "height": 180,
        "depth": 65,
        "weight": 75
      },
      "photo_ids": ["photo-1", "photo-2", "photo-3"],
      "tags": ["energy-efficient", "frost-free"]
    }
    """

  static let conditions = """
    [
      { "id": "cond-1", "value": "Like New" },
      { "id": "cond-2", "value": "Good" },
      { "id": "cond-3", "value": "Fair" }
    ]
    """

  static let durations = """
    [
      { "id": "dur-1", "value": "30 min" },
      { "id": "dur-2", "value": "1 hour" },
      { "id": "dur-3", "value": "2 hours" }
    ]
    """

  static let sellingReasons = """
    [
      { "id": "reason-1", "value": "Moving out" },
      { "id": "reason-2", "value": "Upgrading" },
      { "id": "reason-3", "value": "No longer needed" },
      { "id": "reason-4", "value": "Other" }
    ]
    """

  static let tags = """
    [
      "energy-efficient",
      "frost-free",
      "stainless-steel"
    ]
    """

  static let calendarPreviewSource = "{delivery_selection}"
  static let calendarPreviewDestination = "{pickup_selection}"
  static let calendarPreviewSourceVariable = "delivery_selection"
  static let calendarPreviewDestinationVariable = "pickup_selection"
  static let calendarPickupSelection = "[\"2026-06-03T09:00:00\",\"2026-06-03T09:30:00\"]"
  static let calendarDeliverySelection = "[\"2026-06-03T14:00:00\"]"
  static let calendarContentJSON = #"""
    {
        "title": "",
        "start_time": "07:00",
        "end_time": "19:00",
        "timeslot_interval_minutes": 30,
        "label_interval_minutes": 60,
        "header_format": "EEE d",
        "timeslot_format": "HH:mm"
    }
    """#

  static let user = """
    {
      "id": "preview-user-1",
      "address": {
        "line1": "42 Preview Lane",
        "city": "Preview City",
        "postcode": "2000",
        "country": "Australia"
      }
    }
    """

  static func seed(key: String, json: String) {
    guard let data = json.data(using: .utf8),
      let parsed = try? JSONDecoder().decode(EVYJson.self, from: data)
    else { return }
    switch parsed {
    case .array(let items):
      for item in items {
        let itemId = item.identifierValue()
        let encoded = (try? JSONEncoder().encode(item)) ?? data
        try? EVY.publicStore.create(
          namespace: EVYNamespace.local,
          resource: key,
          id: itemId,
          value: encoded
        )
      }
    case .dictionary:
      let itemId = parsed.identifierValue()
      try? EVY.publicStore.create(
        namespace: EVYNamespace.local,
        resource: key,
        id: itemId,
        value: data
      )
    default:
      try? EVY.publicStore.create(
        namespace: EVYNamespace.local,
        resource: key,
        id: EVYNamespace.singletonId,
        value: data
      )
    }
  }

  static func seedCommon() {
    seed(key: "item", json: item)
    seed(key: "conditions", json: conditions)
    seed(key: "durations", json: durations)
    seed(key: "selling_reasons", json: sellingReasons)
    seed(key: "tags", json: tags)
  }

  static func decodeRow(from json: String) -> UI_Row? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(UI_Row.self, from: data)
  }

  /// Decomposes a nested row JSON tree into flat `evy:rows:<id>` records in the public
  /// store (mirroring the backend's decompose logic). Returns the root row id.
  @discardableResult
  static func seedRowTree(json: String) -> String? {
    guard let data = json.data(using: .utf8),
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    decomposeAndSeedRow(root)
    return root["id"] as? String
  }

  private static func decomposeAndSeedRow(_ rowObject: [String: Any]) {
    let metadataKeys: Set<String> = ["id", "name", "type", "visible", "child", "children"]
    var dataFields: [String: Any] = [:]

    for (key, value) in rowObject {
      if metadataKeys.contains(key) { continue }
      dataFields[key] = value
    }

    if let child = rowObject["child"] as? [String: Any], let childId = child["id"] as? String {
      dataFields["child_row_id"] = childId
      decomposeAndSeedRow(child)
    }

    if let children = rowObject["children"] as? [[String: Any]] {
      dataFields["children_row_ids"] = children.compactMap { $0["id"] as? String }
      for child in children { decomposeAndSeedRow(child) }
    }

    guard let id = rowObject["id"] as? String else { return }
    let name = rowObject["name"] as? String ?? rowObject["type"] as? String ?? "row"
    let typeName = rowObject["type"] as? String ?? ""
    let visible = rowObject["visible"] as? String ?? "true"

    let record: [String: Any] = [
      "id": id,
      "name": name,
      "type": typeName,
      "visible": visible,
      "data": dataFields,
    ]

    guard let bytes = try? JSONSerialization.data(withJSONObject: record) else { return }
    try? EVY.publicStore.upsert(
      namespace: EVYNamespace.evy,
      resource: EVYCoreResource.rows.rawValue,
      id: id,
      value: bytes
    )
  }
}

@MainActor
struct EVYPreviewRow: View {
  private let rowId: String?
  private let failureMessage: String

  init(
    json: String,
    failureMessage: String,
    seed: @MainActor () -> Void = EVYPreviewMockData.seedCommon
  ) {
    seed()
    self.rowId = EVYPreviewMockData.seedRowTree(json: json)
    self.failureMessage = failureMessage
  }

  var body: some View {
    if let rowId {
      EVYRow(rowId: rowId)
    } else {
      Text(failureMessage)
    }
  }
}
