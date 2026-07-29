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
    createdAt: String? = nil,
    type: String? = nil,
    value: String? = nil,
    messageId: String? = nil,
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
    if let messageId {
      data["message_id"] = .string(messageId)
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
    if let createdAt {
      dict["createdAt"] = .string(createdAt)
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
    createdAt: String? = nil
  ) -> EVYJson {
    message(
      id: id,
      fk: fk,
      service: service,
      resource: resource,
      createdAt: createdAt,
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
      messageId: requestId
    )
  }
}
