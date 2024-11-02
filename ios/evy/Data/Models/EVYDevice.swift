//
//  EVYDevice.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

struct EVYDevice: Codable {
    let id: UUID
    let token: String
    let os: EVYOS
    let created_at: String
}

enum EVYOS: String, Codable {
    case ios
    case android
}
