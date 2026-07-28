//
//  EVYTestMessageFixtures.swift
//  evyTests
//

@testable import evy

enum EVYTestMessageFixtures {
  static func message(
    id: String,
    fk: String? = nil,
    status: String? = nil,
    archivedAt: EVYJson? = nil,
    type: String? = nil,
    time: String? = nil,
    postalcode: String? = nil
  ) -> EVYJson {
    var data: [String: EVYJson] = [:]
    if let type {
      data["type"] = .string(type)
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
    if let archivedAt {
      dict["archivedAt"] = archivedAt
    }
    if let status {
      dict["status"] = .string(status)
    }
    if !data.isEmpty {
      dict["data"] = .dictionary(data)
    }
    // Messages are private records, so a realistic fixture routes to the private store.
    dict["visibility"] = .string("private")
    return .dictionary(dict)
  }
}
