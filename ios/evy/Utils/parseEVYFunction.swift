//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation

func parseEVYFunction(_ input: String) -> String? {
    if let match = firstFunctionMatch(input) {
        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let functionName = String(input[...matchStartIndex])
        
        if functionName == "count" {
            return evyCount(input: input, match: match)
        }
    }
    
    return nil
}

private func evyCount(input: String, match: NSTextCheckingResult) -> String? {
    let range = Range(match.range(at: 1), in: input)
    do {
        let test = String(input[range!])
        let data = try EVYData.shared.parse(test).data(using: .utf8)!
        let array = try! JSONDecoder().decode(EVYJsonArray.self, from: data)
        return String(array.count)
    } catch {}
    
    return nil
}

private func firstFunctionMatch(_ self: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: "\\(([^)]*)\\)")
        if let match = regex.firstMatch(in: self, range: NSRange(self.startIndex..., in: self)) {
            return match
        }
    } catch {}
    
    return nil
}
