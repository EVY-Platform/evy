//
//  FManager.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

enum FManagerError: Error {
    case loginError
}

let API_HOST = ProcessInfo.processInfo.environment["API_HOST"] ?? "localhost:8000"

final class FManager {
    private var rpcWS = FWebsocket.init(host: API_HOST)
    static let shared = FManager()
    
    private init() {}
    
    public func setup() async throws {
        try await rpcWS.connect(token: "Geo", os: FOS.ios)
    }
    
    public func fetchServicesData() async throws -> Array<FService> {
        try await rpcWS.fetchServicesData(lastSyncTime: Date().timeIntervalSince1970-100000)
    }
}
