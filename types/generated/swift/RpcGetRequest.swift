// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let rPCGetRequest = try RPCGetRequest(json)

import Foundation

/// JSON-RPC params for get method
// MARK: - RPCGetRequest
struct RPCGetRequest: Codable {
    let filter: Filter?
    let namespace: Namespace
    let resource: Resource
}

// MARK: RPCGetRequest convenience initializers and mutators

extension RPCGetRequest {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RPCGetRequest.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        filter: Filter?? = nil,
        namespace: Namespace? = nil,
        resource: Resource? = nil
    ) -> RPCGetRequest {
        return RPCGetRequest(
            filter: filter ?? self.filter,
            namespace: namespace ?? self.namespace,
            resource: resource ?? self.resource
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Filter
struct Filter: Codable {
    let id: String
}

// MARK: Filter convenience initializers and mutators

extension Filter {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Filter.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        id: String? = nil
    ) -> Filter {
        return Filter(
            id: id ?? self.id
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum Namespace: String, Codable {
    case evy = "evy"
    case marketplace = "marketplace"
}

enum Resource: String, Codable {
    case conditions = "Conditions"
    case device = "Device"
    case durations = "Durations"
    case items = "Items"
    case organisation = "Organisation"
    case provider = "Provider"
    case sdui = "SDUI"
    case sellingReason = "SellingReason"
    case service = "Service"
}

// MARK: - Helper functions for creating encoders and decoders

func newJSONDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        decoder.dateDecodingStrategy = .iso8601
    }
    return decoder
}

func newJSONEncoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        encoder.dateEncodingStrategy = .iso8601
    }
    return encoder
}
