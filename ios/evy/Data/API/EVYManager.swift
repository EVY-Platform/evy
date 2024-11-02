//
//  EVYManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

enum EVYManagerError: Error {
    case loginError
}

let API_HOST = ProcessInfo.processInfo.environment["API_HOST"] ?? "localhost:8000"
let userDefault = UserDefaults.standard

final class EVYManager {
    private let rpcWS = EVYWebsocket(host: API_HOST)
    static let shared = EVYManager()
    
    private init() {}
    
    public func setup() async throws {
        try await rpcWS.connect(token: "Geo", os: EVYOS.ios)
        try await syncServices()
    }
    
    private func syncServices() async throws {
        let lastSyncTime = userDefault.integer(forKey: "lastSyncTime")
        _ = try await rpcWS.fetchServicesData(lastSyncTime: lastSyncTime)
        userDefault.set(Int(Date().timeIntervalSince1970*1000), forKey: "lastSyncTime")
    }
}
