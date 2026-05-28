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

  static let calendarPickupSelection = "[\"2024-09-18T09:00:00\",\"2024-09-18T09:30:00\"]"
  static let calendarDeliverySelection = "[\"2024-09-19T14:00:00\"]"
  static let calendarContentJSON = """
    {
        "title": "",
        "start_time": "07:00",
        "end_time": "19:00",
        "timeslot_interval_minutes": 30,
        "label_interval_minutes": 60,
        "header_format": "EEE d",
        "primary": "{pickup_selection}",
        "secondary": "{delivery_selection}"
    }
    """

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
}

@MainActor
struct EVYPreviewRow: View {
  private let row: UI_Row?
  private let failureMessage: String

  init(
    json: String,
    failureMessage: String,
    seed: @MainActor () -> Void = EVYPreviewMockData.seedCommon
  ) {
    seed()
    self.row = EVYPreviewMockData.decodeRow(from: json)
    self.failureMessage = failureMessage
  }

  var body: some View {
    if let row {
      EVYRow(row: row)
    } else {
      Text(failureMessage)
    }
  }
}
