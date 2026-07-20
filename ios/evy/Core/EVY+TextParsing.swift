//
//  EVY+TextParsing.swift
//  evy
//

import Foundation

extension EVY {
  static func getDataFromText(_ input: String) throws -> EVYJson {
    try _getDataFromText(input)
  }

  static func getDataFromProps(_ props: String) throws -> EVYJson {
    try _getDataFromProps(props)
  }

  static func getValueFromText(_ input: String, editing: Bool = false) throws -> EVYValue {
    try _getValueFromText(input, editing: editing)
  }

  static func parsePropsFromText(_ input: String) -> String {
    _parsePropsFromText(input)
  }

  static func watchTargets(for text: String) -> [String] {
    _watchTargets(for: text)
  }

  static func evaluateFromText(_ input: String) throws -> Bool {
    try _evaluateFromText(input)
  }

  static func formatData(json: EVYJson, format: String) throws -> String {
    try _formatData(json: json, format: format)
  }

  static func formatDataOrToString(json: EVYJson, format: String?) throws -> String {
    guard let format, !format.isEmpty else {
      return json.toString()
    }
    return try formatData(json: json, format: format)
  }

  static func displayText(fromSource source: String?, destination: String?) -> String {
    _displayText(fromSource: source, destination: destination)
  }

  static func editableText(fromSource source: String?, destination: String?) -> String {
    _editableText(fromSource: source, destination: destination)
  }

  static func watchTargets(forSource source: String?, destination: String?) -> [String] {
    _watchTargets(forSource: source, destination: destination)
  }

  static func displayText(forDatum datum: EVYJson, valueTemplate: String?) throws -> String {
    try _displayText(forDatum: datum, valueTemplate: valueTemplate)
  }

  static func displayLabels(for options: [EVYJson], valueTemplate: String?) -> [String] {
    options.map {
      (try? displayText(forDatum: $0, valueTemplate: valueTemplate)) ?? $0.toString()
    }
  }
}
