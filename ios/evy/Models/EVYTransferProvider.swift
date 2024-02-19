//
//  FDevice.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

struct EVYTransferProvider: Codable {
    let id: UUID
    let name: String
    let logo_id: String
    let cost: EVYCost
    
}
