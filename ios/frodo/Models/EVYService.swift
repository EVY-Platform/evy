//
//  FDevice.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

struct EVYService: Codable {
    let id: UUID
    let name: String
    let description: String
    let created_at: String
    let updated_at: String
    let providers: Array<EVYServiceProvider>?
}
