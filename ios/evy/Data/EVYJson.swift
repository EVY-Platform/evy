//
//  EVYJson.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData
import SwiftUI

public typealias EVYJsonString = String
public typealias EVYJsonArray = [EVYJson]
public typealias EVYJsonDict = [String: EVYJson]

public enum EVYDataModelError: Error {
    case idIsNotAString
    case propertyNotFound
    case dataIsAString
    case unprocessableValue
}

public enum EVYJson: Codable {
    case string(EVYJsonString)
    case dictionary(EVYJsonDict)
    case array(EVYJsonArray)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let stringValue = try? container.decode(EVYJsonString.self) {
            self = .string(stringValue)
            return
        }

        if let dictionaryValue = try? container.decode(EVYJsonDict.self) {
            self = .dictionary(dictionaryValue)
            return
        }

        if let arrayValue = try? container.decode(EVYJsonArray.self) {
            self = .array(arrayValue)
            return
        }

        throw DecodingError.dataCorruptedError(in: container,
                                               debugDescription: "EVYJson value cannot be decoded")
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let jsonData):
            try container.encode(jsonData)
        case .dictionary(let jsonData):
            try container.encode(jsonData)
        case .array(let jsonData):
            try container.encode(jsonData)
        }
    }
    
    public func toString() -> String {
        let encoder = JSONEncoder()
        
        switch self {
        case .string(let stringValue):
            return stringValue
        case .array(let arrayValue):
            guard let data = try? encoder.encode(arrayValue) else {
                return arrayValue.description
            }
            guard let string = String(data: data, encoding: .utf8) else {
                return arrayValue.description
            }
            return string
        case .dictionary(let dictValue):
            guard let data = try? encoder.encode(dictValue) else {
                return dictValue.description
            }
            guard let string = String(data: data, encoding: .utf8) else {
                return dictValue.description
            }
            return string
        }
    }
    
    public static func getValueAtProp(data: EVYJsonDict, prop: String) throws -> EVYJson {
        guard let subData = data[prop] else {
            throw EVYDataModelError.propertyNotFound
        }
        return subData
    }
}

@Model class EVYData {
    var id: String
    var data: Data
    
    init(id: String, data: Data) {
        self.id = id
        self.data = data
    }
    
    func decoded() -> EVYJson {
        return try! JSONDecoder().decode(EVYJson.self, from: self.data)
    }
}

struct EVYDataFactory {
    public static func create(_ data: Data) throws -> [EVYData] {
        let objects = try! createFromData(data: data)
        for object in objects {
            EVYDataManager.i.create(object)
        }
        return objects
    }
    
    private static func createFromData(data: Data) throws -> [EVYData] {
        let json = try! JSONDecoder().decode(EVYJson.self, from: data)
        switch json {
        case .string(_):
            throw EVYDataModelError.dataIsAString
        case .array(let arrayValue):
            var response: [EVYData] = []
            let encoder = JSONEncoder()
            for val in arrayValue {
                guard let valEncoded = try? encoder.encode(val) else {
                    throw EVYDataModelError.unprocessableValue
                }
                response.append(contentsOf: try! createFromData(data: valEncoded))
            }
            return response
        case .dictionary(let dictValue):
            let res = try! EVYJson.getValueAtProp(data: dictValue, prop: "id")
            switch res {
            case .string(let stringValue):
                return [EVYData(id: stringValue, data: data)]
            default:
                throw EVYDataModelError.idIsNotAString
            }
        }
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    let items = try! EVYDataFactory.create(item)
    return VStack {
        ForEach(items) { i in
            Text(i.id)
        }
    }
}

