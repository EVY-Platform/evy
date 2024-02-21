//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation

func parseEVYData(_ input: String) -> String {
    if let match = firstDataMatch(input) {
        let matchIdx = match.range.location

        let matchUpperBound = match.range.upperBound
        let matchLowerBound = match.range.lowerBound > 0 ? match.range.lowerBound-1 : 0
        let matchStartIndex = input.index(input.startIndex, offsetBy: matchLowerBound)
        let remainingIndex = input.index(input.startIndex, offsetBy: matchUpperBound)
        
        let range = Range(match.range(at: 1), in: input)
        var variable = String(input[range!])
        do {
            variable = try EVYData.shared.parse(variable)
        } catch {}
        
        let start = matchIdx > 0 ? parseEVYData(String(input[...matchStartIndex])) : ""
        let end = matchUpperBound < input.count ? parseEVYData(String(input[remainingIndex...])) : ""
        return start + variable + end
    } else {
        return input
    }
}

private func firstDataMatch(_ self: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: "\\{([^}]*)\\}")
        if let match = regex.firstMatch(in: self, range: NSRange(self.startIndex..., in: self)) {
            return match
        }
    } catch {}
    
    return nil
}
