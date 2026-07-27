//
//  EVYData.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import CoreLocation
import Foundation
import SwiftData

enum EVYDataParseError: Error {
  case invalidProps
  case invalidVariable
}

struct EVYValue: Equatable {
  var value: String
  var prefix: String?
  var suffix: String?

  init(_ value: String, _ prefix: String?, _ suffix: String?) {
    self.value = value
    self.prefix = prefix
    self.suffix = suffix
  }

  func toString() -> String {
    return "\(prefix ?? "")\(value)\(suffix ?? "")"
  }
}

enum EVYNamespace {
  static let evy = EVY_CORE_SERVICE
  static let local = "local"
  static let cache = "cache"
  static let draft = "draft"

  static let singletonId = "current"
}

@Model
class EVYData {
  var namespace: String
  var resource: String
  var id: String
  var data: Data
  var sortIndex: Int = 0

  init(
    namespace: String,
    resource: String,
    id: String,
    data: Data,
    sortIndex: Int = 0
  ) {
    self.namespace = namespace
    self.resource = resource
    self.id = id
    self.data = data
    self.sortIndex = sortIndex
  }

  func decoded() throws -> EVYJson {
    try JSONDecoder().decode(EVYJson.self, from: data)
  }
}

enum EVYJson: Codable, Hashable {
  case string(String)
  case int(Int)
  case decimal(Decimal)
  case bool(Bool)
  case dictionary([String: EVYJson])
  case array([EVYJson])
  case null

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()

    if container.decodeNil() {
      self = .null
      return
    }

    if let stringValue = try? container.decode(String.self) {
      self = .string(stringValue)
      return
    }

    if let intValue = try? container.decode(Int.self) {
      self = .int(intValue)
      return
    }

    if let decimalValue = try? container.decode(Decimal.self) {
      self = .decimal(decimalValue)
      return
    }

    if let boolValue = try? container.decode(Bool.self) {
      self = .bool(boolValue)
      return
    }

    if let arrayValue = try? container.decode([EVYJson].self) {
      self = .array(arrayValue)
      return
    }

    if let dictValue = try? container.decode([String: EVYJson].self) {
      self = .dictionary(dictValue)
      return
    }

    throw DecodingError.dataCorruptedError(
      in: container, debugDescription: "Unknown EVYJson value")
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()

    switch self {
    case .string(let value):
      try container.encode(value)
    case .int(let value):
      try container.encode(value)
    case .decimal(let value):
      try container.encode(value)
    case .bool(let value):
      try container.encode(value)
    case .dictionary(let value):
      try container.encode(value)
    case .array(let value):
      try container.encode(value)
    case .null:
      try container.encodeNil()
    }
  }

  func toString() -> String {
    let encoder = JSONEncoder()

    switch self {
    case .string(let stringValue):
      return stringValue
    case .int(let intValue):
      return "\(intValue)"
    case .decimal(let decimalValue):
      return "\(decimalValue)"
    case .bool(let boolValue):
      return boolValue ? "true" : "false"
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
    case .null:
      return ""
    }
  }

  func locationCoordinate() -> CLLocationCoordinate2D? {
    guard case .dictionary(let value) = self,
      let latitude = value["latitude"]?.doubleValue,
      let longitude = value["longitude"]?.doubleValue,
      (-90...90).contains(latitude), (-180...180).contains(longitude)
    else {
      return nil
    }
    return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
  }

  private var doubleValue: Double? {
    switch self {
    case .decimal(let decimal):
      return NSDecimalNumber(decimal: decimal).doubleValue
    case .int(let int):
      return Double(int)
    case .string(let string):
      return Double(string)
    default:
      return nil
    }
  }

  @MainActor
  func identifierValue() -> String {
    switch self {
    case .dictionary(_):
      return parseProp(props: ["id"]).toString()
    default:
      return toString()
    }
  }

  @MainActor
  func parseProp(props: [String]) -> EVYJson {
    if props.count < 1 {
      return self
    }

    switch self {
    case .dictionary(let dictValue):
      guard let firstVariable = props.first else {
        return self
      }
      guard let subData = dictValue[firstVariable] else {
        return self
      }
      if props.count == 1 {
        return subData
      }

      return subData.parseProp(props: Array(props[1...]))
    case .array(let arrayValue):
      guard let firstVariable = props.first else {
        return self
      }
      guard let index = Int(firstVariable) else {
        return self
      }

      let subData = arrayValue[index]
      if props.count == 1 {
        return subData
      }
      return subData.parseProp(props: Array(props[1...]))
    default:
      return self
    }
  }

  /// Like `parseProp`, but returns `nil` when a segment cannot be resolved instead of
  /// falling back to `self`. Used to tell "the path resolves to a real value" apart from
  /// "the container could not descend into the requested path".
  @MainActor
  func parsePropStrict(props: [String]) -> EVYJson? {
    guard let firstVariable = props.first else {
      return self
    }

    switch self {
    case .dictionary(let dictValue):
      guard let subData = dictValue[firstVariable] else {
        return nil
      }
      return subData.parsePropStrict(props: Array(props[1...]))
    case .array(let arrayValue):
      guard let index = Int(firstVariable), arrayValue.indices.contains(index) else {
        return nil
      }
      return arrayValue[index].parsePropStrict(props: Array(props[1...]))
    default:
      return nil
    }
  }
}

enum EVYDataPatcher {
  static func patch(encodedData: Data, newData: Data, props: [String]) throws -> Data {
    let currentDataAsJson = try JSONDecoder().decode(EVYJson.self, from: encodedData)
    let newDataAsJson = try JSONDecoder().decode(EVYJson.self, from: newData)
    let updatedJson = try updatedJson(props: props, data: currentDataAsJson, value: newDataAsJson)
    return try JSONEncoder().encode(updatedJson)
  }

  private static func updatedJson(props: [String], data: EVYJson, value: EVYJson) throws -> EVYJson
  {
    if props.count < 1 {
      return data
    }

    switch data {
    case .dictionary(var dictValue):
      guard let firstProp = props.first else {
        throw EVYDataParseError.invalidProps
      }
      if props.count == 1 {
        dictValue[firstProp] = value
      } else {
        let subData = dictValue[firstProp] ?? .dictionary([:])
        dictValue[firstProp] = try updatedJson(
          props: Array(props[1...]), data: subData, value: value)
      }
      return .dictionary(dictValue)
    case .array(var arrayValue):
      guard let firstProp = props.first else {
        throw EVYDataParseError.invalidProps
      }
      guard let index = Int(firstProp) else {
        throw EVYDataParseError.invalidProps
      }
      let subData = arrayValue[index]
      if props.count == 1 {
        arrayValue[index] = value
      } else {
        arrayValue[index] = try updatedJson(
          props: Array(props[1...]), data: subData, value: value)
      }
      return .array(arrayValue)
    default:
      return data
    }
  }
}
