//
//  chunked.swift
//  evy
//
//  Created by Geoffroy Lesage on 17/12/2023.
//

import Foundation

func evyCount(_ args: String, _ onCompletion: (String) -> Void) {
    do {
        try EVYDataManager.i.parseProps(args) { res in
            switch res {
            case .array(let arrayValue):
                onCompletion(String(arrayValue.count))
            default:
                onCompletion(args)
            }
        }
    } catch {
        onCompletion(args)
    }
}
