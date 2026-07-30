//
//  EVYTestMessageFixtures.swift
//  evyTests
//

@testable import evy

enum EVYTestMessageFixtures {
  static func message(
    id: String,
    fk: String? = nil,
    service: String? = nil,
    resource: String? = nil,
    created_at: String? = nil,
    type: String? = nil,
    value: String? = nil,
    parent_message_id: String? = nil,
    time: String? = nil,
    postalcode: String? = nil
  ) -> EVYJson {
    var data: [String: EVYJson] = [:]
    if let type {
      data["type"] = .string(type)
    }
    if let value {
      data["value"] = .string(value)
    }
    if let time {
      data["time"] = .string(time)
    }
    if let postalcode {
      data["postalcode"] = .string(postalcode)
    }

    var dict: [String: EVYJson] = [
      "id": .string(id)
    ]
    if let fk {
      dict["fk"] = .string(fk)
    }
    if let service {
      dict["service"] = .string(service)
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
    if !data.isEmpty {
      dict["data"] = .dictionary(data)
    }
    dict["visibility"] = .string("private")
    return .dictionary(dict)
  }

  static func request(
    id: String,
    fk: String,
    service: String,
    resource: String,
    type: String = "pickup",
    time: String? = "2026-06-03T09:00:00",
    created_at: String? = nil
  ) -> EVYJson {
    message(
      id: id,
      fk: fk,
      service: service,
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
    service: String,
    resource: String,
    value: String,
    type: String = "pickup"
  ) -> EVYJson {
    message(
      id: id,
      fk: fk,
      service: service,
      resource: resource,
      type: type,
      value: value,
      parent_message_id: requestId
    )
  }
}
