// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let dataData = try DataData(json)

import Foundation

/// API persistence row types: DATA_Flow, DATA_Device, DATA_Service, etc.
// MARK: - DataData
struct DataData: Codable {
    let createdAt: Date
    let data: SDUIFlow?
    let id: String?
    let updatedAt: Date?
    let os: OS?
    let token: String?
    let description: String?
    let name: String?
    let logo: String?
    let supportEmail, url: String?
    let fkOrganizationID, fkServiceID: String?
    let retired: Bool?

    enum CodingKeys: String, CodingKey {
        case createdAt, data, id, updatedAt, os, token, description, name, logo, supportEmail, url
        case fkOrganizationID = "fkOrganizationId"
        case fkServiceID = "fkServiceId"
        case retired
    }
}

// MARK: DataData convenience initializers and mutators

extension DataData {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(DataData.self, from: data)
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
        createdAt: Date? = nil,
        data: SDUIFlow?? = nil,
        id: String?? = nil,
        updatedAt: Date?? = nil,
        os: OS?? = nil,
        token: String?? = nil,
        description: String?? = nil,
        name: String?? = nil,
        logo: String?? = nil,
        supportEmail: String?? = nil,
        url: String?? = nil,
        fkOrganizationID: String?? = nil,
        fkServiceID: String?? = nil,
        retired: Bool?? = nil
    ) -> DataData {
        return DataData(
            createdAt: createdAt ?? self.createdAt,
            data: data ?? self.data,
            id: id ?? self.id,
            updatedAt: updatedAt ?? self.updatedAt,
            os: os ?? self.os,
            token: token ?? self.token,
            description: description ?? self.description,
            name: name ?? self.name,
            logo: logo ?? self.logo,
            supportEmail: supportEmail ?? self.supportEmail,
            url: url ?? self.url,
            fkOrganizationID: fkOrganizationID ?? self.fkOrganizationID,
            fkServiceID: fkServiceID ?? self.fkServiceID,
            retired: retired ?? self.retired
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// SDUI types: SDUI_Flow, SDUI_Page, SDUI_Row
// MARK: - SDUIFlow
struct SDUIFlow: Codable {
    let data, id: String?
    let name: String?
    let pages: [EvySchema]?
    let type: DataType?
    let evy, marketplace: [String: EvyValue]?
}

// MARK: SDUIFlow convenience initializers and mutators

extension SDUIFlow {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SDUIFlow.self, from: data)
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
        data: String?? = nil,
        id: String?? = nil,
        name: String?? = nil,
        pages: [EvySchema]?? = nil,
        type: DataType?? = nil,
        evy: [String: EvyValue]?? = nil,
        marketplace: [String: EvyValue]?? = nil
    ) -> SDUIFlow {
        return SDUIFlow(
            data: data ?? self.data,
            id: id ?? self.id,
            name: name ?? self.name,
            pages: pages ?? self.pages,
            type: type ?? self.type,
            evy: evy ?? self.evy,
            marketplace: marketplace ?? self.marketplace
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum EvyValue: Codable {
    case bool(Bool)
    case double(Double)
    case integer(Int)
    case string(String)
    case unionArray([EvyElement])
    case unionMap([String: EvyElement])
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
        if let x = try? container.decode([EvyElement].self) {
            self = .unionArray(x)
            return
        }
        if let x = try? container.decode(Double.self) {
            self = .double(x)
            return
        }
        if let x = try? container.decode([String: EvyElement].self) {
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
        throw DecodingError.typeMismatch(EvyValue.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for EvyValue"))
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

enum EvyElement: Codable {
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
        throw DecodingError.typeMismatch(EvyElement.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for EvyElement"))
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

// MARK: - EvySchema
struct EvySchema: Codable {
    let footer: Footer?
    let id: String
    let rows: [Footer]
    let title: String
}

// MARK: EvySchema convenience initializers and mutators

extension EvySchema {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvySchema.self, from: data)
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
        footer: Footer?? = nil,
        id: String? = nil,
        rows: [Footer]? = nil,
        title: String? = nil
    ) -> EvySchema {
        return EvySchema(
            footer: footer ?? self.footer,
            id: id ?? self.id,
            rows: rows ?? self.rows,
            title: title ?? self.title
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Content
struct Content: Codable {
    let child: Footer?
    let children: [Footer]?
    let segments: [String]?
    let title: String
}

// MARK: Content convenience initializers and mutators

extension Content {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Content.self, from: data)
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
        child: Footer?? = nil,
        children: [Footer]?? = nil,
        segments: [String]?? = nil,
        title: String? = nil
    ) -> Content {
        return Content(
            child: child ?? self.child,
            children: children ?? self.children,
            segments: segments ?? self.segments,
            title: title ?? self.title
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - View
struct View: Codable {
    let content: Content
    let data, maxLines: String?

    enum CodingKeys: String, CodingKey {
        case content, data
        case maxLines = "max_lines"
    }
}

// MARK: View convenience initializers and mutators

extension View {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(View.self, from: data)
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
        content: Content? = nil,
        data: String?? = nil,
        maxLines: String?? = nil
    ) -> View {
        return View(
            content: content ?? self.content,
            data: data ?? self.data,
            maxLines: maxLines ?? self.maxLines
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Footer
class Footer: Codable {
    let action: Action?
    let edit: Edit?
    let id: String
    let type: FooterType
    let view: View

    init(action: Action?, edit: Edit?, id: String, type: FooterType, view: View) {
        self.action = action
        self.edit = edit
        self.id = id
        self.type = type
        self.view = view
    }
}

// MARK: Footer convenience initializers and mutators

extension Footer {
    convenience init(data: Data) throws {
        let me = try newJSONDecoder().decode(Footer.self, from: data)
        self.init(action: me.action, edit: me.edit, id: me.id, type: me.type, view: me.view)
    }

    convenience init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    convenience init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        action: Action?? = nil,
        edit: Edit?? = nil,
        id: String? = nil,
        type: FooterType? = nil,
        view: View? = nil
    ) -> Footer {
        return Footer(
            action: action ?? self.action,
            edit: edit ?? self.edit,
            id: id ?? self.id,
            type: type ?? self.type,
            view: view ?? self.view
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Action
struct Action: Codable {
    let target: String
}

// MARK: Action convenience initializers and mutators

extension Action {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Action.self, from: data)
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
        target: String? = nil
    ) -> Action {
        return Action(
            target: target ?? self.target
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Edit
struct Edit: Codable {
    let destination: String?
    let validation: Validation?
}

// MARK: Edit convenience initializers and mutators

extension Edit {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Edit.self, from: data)
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
        destination: String?? = nil,
        validation: Validation?? = nil
    ) -> Edit {
        return Edit(
            destination: destination ?? self.destination,
            validation: validation ?? self.validation
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Validation
struct Validation: Codable {
    let message, minAmount, minCharacters, minValue: String?
    let validationRequired: String?

    enum CodingKeys: String, CodingKey {
        case message, minAmount, minCharacters, minValue
        case validationRequired = "required"
    }
}

// MARK: Validation convenience initializers and mutators

extension Validation {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Validation.self, from: data)
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
        message: String?? = nil,
        minAmount: String?? = nil,
        minCharacters: String?? = nil,
        minValue: String?? = nil,
        validationRequired: String?? = nil
    ) -> Validation {
        return Validation(
            message: message ?? self.message,
            minAmount: minAmount ?? self.minAmount,
            minCharacters: minCharacters ?? self.minCharacters,
            minValue: minValue ?? self.minValue,
            validationRequired: validationRequired ?? self.validationRequired
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

enum FooterType: String, Codable {
    case button = "Button"
    case calendar = "Calendar"
    case columnContainer = "ColumnContainer"
    case dropdown = "Dropdown"
    case info = "Info"
    case inlinePicker = "InlinePicker"
    case input = "Input"
    case inputList = "InputList"
    case listContainer = "ListContainer"
    case search = "Search"
    case selectPhoto = "SelectPhoto"
    case selectSegmentContainer = "SelectSegmentContainer"
    case sheetContainer = "SheetContainer"
    case text = "Text"
    case textAction = "TextAction"
    case textArea = "TextArea"
    case textSelect = "TextSelect"
}

enum DataType: String, Codable {
    case create = "create"
    case delete = "delete"
    case read = "read"
    case update = "update"
    case write = "write"
}

enum OS: String, Codable {
    case android = "android"
    case ios = "ios"
    case web = "Web"
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
