//
//  FDevice.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

struct FDevice: Codable {
    let token: String
    let os: FOS
    let created_at: String
    let updated_at: String
}

enum FOS: String, Codable {
    case ios = "ios"
    case android = "android"
}