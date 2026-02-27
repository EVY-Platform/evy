// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let rPCUpsertRequest = try RPCUpsertRequest(json)

import Foundation

/// JSON-RPC params for upsert method
// MARK: - RPCUpsertRequest
struct RPCUpsertRequest: Codable {
    let data: [String: DatumValue]
    let filter: Filter?
    let namespace: Namespace
    let resource: Resource
}

// MARK: RPCUpsertRequest convenience initializers and mutators

extension RPCUpsertRequest {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RPCUpsertRequest.self, from: data)
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
        data: [String: DatumValue]? = nil,
        filter: Filter?? = nil,
        namespace: Namespace? = nil,
        resource: Resource? = nil
    ) -> RPCUpsertRequest {
        return RPCUpsertRequest(
            data: data ?? self.data,
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

enum DatumValue: Codable {
    case bool(Bool)
    case double(Double)
    case integer(Int)
    case string(String)
    case unionArray([DatumElement])
    case unionMap([String: DatumElement])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(Bool.self) {
            self = .bool(x)
            return
        }
        if let x = try? container.decode(Int.self) {
            self = .integer(x)
            return
        }
        if let x = try? container.decode([DatumElement].self) {
            self = .unionArray(x)
            return
        }
        if let x = try? container.decode(Double.self) {
            self = .double(x)
            return
        }
        if let x = try? container.decode([String: DatumElement].self) {
            self = .unionMap(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(DatumValue.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for DatumValue"))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let x):
            try container.encode(x)
        case .double(let x):
            try container.encode(x)
        case .integer(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        case .unionArray(let x):
            try container.encode(x)
        case .unionMap(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
    }
}

enum DatumElement: Codable {
    case bool(Bool)
    case double(Double)
    case integer(Int)
    case string(String)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(Bool.self) {
            self = .bool(x)
            return
        }
        if let x = try? container.decode(Int.self) {
            self = .integer(x)
            return
        }
        if let x = try? container.decode(Double.self) {
            self = .double(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        if container.decodeNil() {
            self = .null
            return
        }
        throw DecodingError.typeMismatch(DatumElement.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for DatumElement"))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let x):
            try container.encode(x)
        case .double(let x):
            try container.encode(x)
        case .integer(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        case .null:
            try container.encodeNil()
        }
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
