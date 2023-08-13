//
//  FDevice.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

struct FServiceProvider: Codable {
    let id: UUID
    let fk_service_id: UUID
    let fk_organization_id: UUID
    let name: String
    let description: String
    let logo: String
    let url: String
    let created_at: String
    let updated_at: String
    let service: FService?
    let organization: FOrganization?
}
