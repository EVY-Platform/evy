//
//  EVYSDUI.swift
//  evy
//
//  Created by Geoffroy Lesage on 5/4/2024.
//

import Foundation

/// App-side parsing of action target strings (e.g. from SDUI_RowAction.target).
public enum SDUI_ActionTarget: Codable {
    case navigate(Route)
    case submit
    case close

    private enum EVYActionError: Error {
        case invalid
        case missingKeywords
        case tooManyKeywords
    }

    /// Parse target string for use in row behaviour.
    public static func parse(_ value: String) throws -> SDUI_ActionTarget {
        let valueSplit = value.split(separator: ":")
        if valueSplit.count < 1 {
            throw EVYActionError.missingKeywords
        }
        if valueSplit.count > 3 {
            throw EVYActionError.tooManyKeywords
        }
        switch valueSplit.first {
        case "navigate":
            guard valueSplit.count >= 3 else { throw EVYActionError.invalid }
            return .navigate(Route(
                flowId: String(valueSplit[1]),
                pageId: String(valueSplit[2])
            ))
        case "submit":
            return .submit
        case "close":
            return .close
        default:
            throw EVYActionError.invalid
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        guard let value = try? container.decode(String.self) else {
            throw EVYActionError.invalid
        }
        self = try SDUI_ActionTarget.parse(value)
    }
}

/// App-side validation parsed from SDUI_RowValidation (string → Bool/Int).
public extension SDUI_RowValidation {
    var requiredBool: Bool { required == "true" }
    var minAmountInt: Int? { minAmount.flatMap { Int($0) } }
    var minValueInt: Int? { minValue.flatMap { Int($0) } }
    var minCharactersInt: Int? { minCharacters.flatMap { Int($0) } }
}
