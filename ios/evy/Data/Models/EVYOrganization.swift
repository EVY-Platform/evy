//
//  FDevice.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

struct EVYOrganization: Codable {
    let id: UUID
    let name: String
    let description: String
    let logo: String
    let url: String
    let support_email: String
    let created_at: String
    let updated_at: String
    let providers: [EVYServiceProvider]?
}
