//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation
import SwiftUI

func parseEVYData(_ input: String) -> (NSTextCheckingResult, String)? {
    if let match = firstDataMatch(input) {
        let range = Range(match.range(at: 1), in: input)
        do {
            let variable = try EVYData.shared.parse(String(input[range!]))
            return (match, variable)
        } catch {
            return (match, String(input[range!]))
        }
    }
    
    return nil
}

private func firstDataMatch(_ input: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: "\\{([^}]*)\\}")
        if let match = regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)) {
            return match
        }
    } catch {}
    
    return nil
}

#Preview {
    let data = EVYData.shared
    
    let item = DataConstants.item.data(using: .utf8)!
    try! data.set(name: "item", data: item)

    if let (_, data) = parseEVYData("{item.title}") {
        return Text(data)
    }
    
    return Text("Error")
}
