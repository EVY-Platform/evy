//
//  EVYOptionLoading.swift
//  evy
//

import Foundation

@MainActor
enum EVYOptionLoading {
  static func loadOptions(from data: String) -> [EVYJson] {
    do {
      let resolved = try EVY.getDataFromText(data)
      if case .array(let arrayValue) = resolved {
        return arrayValue
      }
    } catch {
    }
    return []
  }
}
