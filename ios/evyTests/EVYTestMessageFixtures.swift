//
//  EVYTestMessageFixtures.swift
//  evyTests
//

@testable import evy

enum EVYTestMessageFixtures {
  static func message(
    id: String,
    fk: String? = nil,
    resource: String? = nil,
    created_at: String? = nil,
    type: String? = nil,
    value: String? = nil,
    parent_message_id: String? = nil,
    time: String? = nil,
    postalcode: String? = nil,
    destination_address: EVYJson? = nil,
    pickup_address: EVYJson? = nil
  ) -> EVYJson {
    var data: [String: EVYJson] = [:]
    if let time {
      data["time"] = .string(time)
    }
    if let postalcode {
      data["postalcode"] = .string(postalcode)
    }
    if let destination_address {
      data["destination_address"] = destination_address
    }
    if let pickup_address {
      data["pickup_address"] = pickup_address
    }

    var dict: [String: EVYJson] = [
      "id": .string(id)
    ]
    if let fk {
      dict["fk"] = .string(fk)
    }
    if let resource {
      dict["resource"] = .string(resource)
    }
    if let created_at {
      dict["created_at"] = .string(created_at)
    }
    if let parent_message_id {
      dict["parent_message_id"] = .string(parent_message_id)
    }
    if let type {
      dict["type"] = .string(type)
    }
    if let value {
      dict["value"] = .string(value)
    }
    if !data.isEmpty {
      dict["data"] = .dictionary(data)
    }
    dict["visibility"] = .string("private")
    return .dictionary(dict)
  }

  static func request(
    id: String,
    fk: String,
    resource: String,
    type: String = "pickup",
    time: String? = "2026-06-03T09:00:00",
    created_at: String? = nil
  ) -> EVYJson {
    message(
      id: id,
      fk: fk,
      resource: resource,
      created_at: created_at,
      type: type,
      value: "pending",
      time: time
    )
  }

  static func response(
    id: String,
    to requestId: String,
    fk: String,
    resource: String,
    value: String,
    type: String = "pickup"
  ) -> EVYJson {
    message(
      id: id,
      fk: fk,
      resource: resource,
      type: type,
      value: value,
      parent_message_id: requestId
    )
  }
}
