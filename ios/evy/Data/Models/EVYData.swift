//
//  EVYData.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData

public enum EVYDataParseError: Error {
  case invalidProps
  case invalidVariable
  case unprocessableValue
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

@Model
class EVYData {
  var key: String
  var lastSyncedAt: String
  var data: Data

  init(key: String, lastSyncedAt: String = "", data: Data) {
    self.key = key
    self.lastSyncedAt = lastSyncedAt
    self.data = data
  }

  func decoded() throws -> EVYJson {
    try JSONDecoder().decode(EVYJson.self, from: data)
  }

  func updateDataWithData(_ data: Data, props: [String]) throws {
    if props.count < 1 {
      return
    }

    let currentDataAsJson = try decoded()
    let newDataAsJson = try JSONDecoder().decode(EVYJson.self, from: data)

    let updatedJson = try getUpdatedJson(
      props: props, data: currentDataAsJson, value: newDataAsJson)
    self.data = try JSONEncoder().encode(updatedJson)
  }

  private func getUpdatedJson(props: [String], data: EVYJson, value: EVYJson) throws -> EVYJson {
    if props.count < 1 {
      return data
    }

    switch data {
    case .dictionary(var dictValue):
      guard let firstProp = props.first else {
        throw EVYDataParseError.invalidProps
      }
      guard let subData = dictValue[firstProp] else {
        throw EVYDataParseError.invalidProps
      }
      if props.count == 1 {
        dictValue[firstProp] = value
        let dictAsData = try JSONEncoder().encode(dictValue)
        return try JSONDecoder().decode(EVYJson.self, from: dictAsData)
      }
      let updatedData = try getUpdatedJson(props: Array(props[1...]), data: subData, value: value)
      if props.count > 1 {
        dictValue[firstProp] = updatedData
        let dictAsData = try JSONEncoder().encode(dictValue)
        return try JSONDecoder().decode(EVYJson.self, from: dictAsData)
      }
      return updatedData
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
        let arrayAsData = try JSONEncoder().encode(arrayValue)
        return try JSONDecoder().decode(EVYJson.self, from: arrayAsData)
      }
      let updatedData = try getUpdatedJson(props: Array(props[1...]), data: subData, value: value)
      if props.count > 1 {
        arrayValue[index] = updatedData
        let arrayAsData = try JSONEncoder().encode(arrayValue)
        return try JSONDecoder().decode(EVYJson.self, from: arrayAsData)
      }
      return updatedData
    default:
      return data
    }
  }
}

public enum EVYJson: Codable, Hashable {
  case string(String)
  case int(Int)
  case decimal(Decimal)
  case bool(Bool)
  case dictionary([String: EVYJson])
  case array([EVYJson])

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()

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

    if let dictionaryValue = try? container.decode([String: EVYJson].self) {
      self = .dictionary(dictionaryValue)
      return
    }

    if let arrayValue = try? container.decode([EVYJson].self) {
      self = .array(arrayValue)
      return
    }

    throw EVYDataParseError.unprocessableValue
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .string(let jsonData):
      try container.encode(jsonData)
    case .int(let jsonData):
      try container.encode(jsonData)
    case .decimal(let jsonData):
      try container.encode(jsonData)
    case .bool(let jsonData):
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
    }
  }

  @MainActor
  public func identifierValue() -> String {
    switch self {
    case .dictionary(_):
      return parseProp(props: ["id"]).toString()
    default:
      return toString()
    }
  }

  @MainActor
  public func parseProp(props: [String]) -> EVYJson {
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
        return parseIdOrIds(props: props, value: subData)
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
        return parseIdOrIds(props: props, value: subData)
      }
      return subData.parseProp(props: Array(props[1...]))
    default:
      return parseIdOrIds(props: props, value: self)
    }
  }

  @MainActor
  private func parseIdOrIds(props: [String], value: EVYJson) -> EVYJson {
    let key = props.first!

    if !key.hasSuffix("_id") && !key.hasSuffix("_ids") {
      return value
    }

    var inputValues: [String] = []
    if case .array(let arrayValue) = value {
      inputValues.append(contentsOf: arrayValue.map { $0.toString() })
    } else if case .string(_) = value {
      inputValues.append(value.toString())
    }

    if inputValues.isEmpty {
      return value
    }

    do {
      if key.hasSuffix("_ids") {
        let data = try EVY.getDataFromProps(String(key.dropLast(4) + "s"))
        if case .array(let arrayValue) = data {
          let filteredValues = arrayValue.filter {
            inputValues.contains($0.identifierValue())
          }
          if filteredValues.count > 0 {
            let data = try JSONEncoder().encode(filteredValues)
            return try JSONDecoder().decode(EVYJson.self, from: data)
          }
        }
      }
      if key.hasSuffix("_id") {
        let data = try EVY.getDataFromProps(String(key.dropLast(3) + "s"))
        if case .array(let arrayValue) = data {
          let matchingValue = arrayValue.first {
            inputValues.contains($0.identifierValue())
          }
          if matchingValue != nil {
            return matchingValue!
          }
        }
      }
    } catch EVYDataError.keyNotFound {
      #if DEBUG
        print("[EVYData] parseIdOrIds: key not found for \(key)")
      #endif
    } catch EVYParamError.invalidProps {
      #if DEBUG
        print("[EVYData] parseIdOrIds: invalid props for \(key)")
      #endif
    } catch {
      #if DEBUG
        print("[EVYData] parseIdOrIds unexpected error: \(error)")
      #endif
      NotificationCenter.default.post(
        name: Notification.Name.evyErrorOccurred,
        object: error
      )
    }

    return value
  }
}
