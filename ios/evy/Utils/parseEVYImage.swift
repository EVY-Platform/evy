//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation
import SwiftUI

func parseEVYImage(_ input: String) -> (NSTextCheckingResult, Image)? {
    if let match = firstIconMatch(input) {
        let range = Range(match.range(at: 1), in: input)
        return (match, Image(systemName: String(input[range!])))
    }
    
    return nil
}

func firstIconMatch(_ input: String) -> NSTextCheckingResult? {
    do {
        let regex = try NSRegularExpression(pattern: "::([^::]*)::")
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
    
    if let image = parseEVYImage("::star.square.on.square.fill::") {
        return Text("\(image.1)")
    }

    return Text("Error")
}
