//
//  EVYTestMessageFixtures.swift
//  evyTests
//

@testable import evy

enum EVYTestMessageFixtures {
  /// A message as the store holds one.
  ///
  /// `value` is the message's state and lives in `data`: "pending" on a request,
  /// "accept" or "reject" on the response answering one. Passing `messageId` names the
  /// request being answered, which is what makes a fixture a response rather than a
  /// request.
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
    // The ordering key for "the latest message about this request". Milliseconds matter: equal
    // keys fall back to store order, which would let a request outrank its own answer.
    if let createdAt {
      dict["createdAt"] = .string(createdAt)
    }
    if !data.isEmpty {
      dict["data"] = .dictionary(data)
    }
    // Messages are private records, so a realistic fixture routes to the private store.
    dict["visibility"] = .string("private")
    return .dictionary(dict)
  }

  /// A transfer request, in the shape the item page's create actions produce.
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

  /// The message that answers a request, addressing the same record the request did.
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
