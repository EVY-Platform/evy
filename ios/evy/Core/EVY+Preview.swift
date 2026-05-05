//
//  EVY+Preview.swift
//  evy
//

import SwiftUI

// MARK: - Preview Mock Data

@MainActor
enum EVYPreviewMockData {

  // MARK: - Item (used by most row previews)

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

  // MARK: - Conditions

  static let conditions = """
    [
      { "id": "cond-1", "value": "Like New" },
      { "id": "cond-2", "value": "Good" },
      { "id": "cond-3", "value": "Fair" }
    ]
    """

  // MARK: - Durations

  static let durations = """
    [
      { "id": "dur-1", "value": "30 min" },
      { "id": "dur-2", "value": "1 hour" },
      { "id": "dur-3", "value": "2 hours" }
    ]
    """

  // MARK: - Selling Reasons

  static let sellingReasons = """
    [
      { "id": "reason-1", "value": "Moving out" },
      { "id": "reason-2", "value": "Upgrading" },
      { "id": "reason-3", "value": "No longer needed" },
      { "id": "reason-4", "value": "Other" }
    ]
    """

  // MARK: - Tags

  static let tags = """
    [
      "energy-efficient",
      "frost-free",
      "stainless-steel"
    ]
    """

  // MARK: - Timeslots

  static let timeslots = """
    [
      {
        "header": "Wed",
        "date": "8 nov.",
        "timeslots": [
          { "timeslot": "11:30", "available": true },
          { "timeslot": "12:00", "available": true }
        ]
      },
      {
        "header": "Thu",
        "date": "9 nov.",
        "timeslots": [
          { "timeslot": "10:30", "available": false },
          { "timeslot": "11:00", "available": true },
          { "timeslot": "12:00", "available": true }
        ]
      },
      {
        "header": "Fri",
        "date": "10 nov.",
        "timeslots": [
          { "timeslot": "10:30", "available": true },
          { "timeslot": "12:00", "available": false },
          { "timeslot": "12:30", "available": true }
        ]
      }
    ]
    """

  // MARK: - User (for $local bindings)

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

  // MARK: - Helpers

  static func seed(key: String, json: String) {
    guard let data = json.data(using: .utf8) else { return }
    try? EVY.publicStore.upsert(key: key, value: data, notify: false)
  }

  static func seedCommon() {
    seed(key: "item", json: item)
    seed(key: "conditions", json: conditions)
    seed(key: "durations", json: durations)
    seed(key: "selling_reasons", json: sellingReasons)
    seed(key: "tags", json: tags)
    seed(key: "timeslots", json: timeslots)
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
