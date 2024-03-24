//
//  EVYJson.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData

@Model
class EVYData {
    var key: String
    var data: Data
    
    init(key: String, data: Data) {
        self.key = key
        self.data = data
    }
    
    func decoded() -> EVYJson {
        return try! JSONDecoder().decode(EVYJson.self, from: self.data)
    }
}
