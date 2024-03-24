//
//  EVYJson.swift
//  evy
//
//  Created by Geoffroy Lesage on 4/3/2024.
//

import Foundation
import SwiftData
import SwiftUI

@Model
class EVYData {
    var dataId: String
    var data: Data
    
    init(id: String, data: Data) {
        self.dataId = id
        self.data = data
    }
    
    func decoded() -> EVYJson {
        return try! JSONDecoder().decode(EVYJson.self, from: self.data)
    }
}

#Preview {
    let item = DataConstants.item.data(using: .utf8)!
    let items = try! EVYDataManager.i.create(item)
    return VStack {
        ForEach(items) { i in
            Text(i.dataId)
        }
    }
}

