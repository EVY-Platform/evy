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
let userDefault = UserDefaults.standard

final class FManager {
    private var rpcWS = FWebsocket.init(host: API_HOST)
    static var shared = FManager()
    
    private init() {}
    
    public func setup() async throws {
        try await rpcWS.connect(token: "Geo", os: FOS.ios)
        try await syncServices()
    }
    
    private func syncServices() async throws {
        let lastSyncTime = userDefault.integer(forKey: "lastSyncTime")
        let remoteServices = try await rpcWS.fetchServicesData(lastSyncTime: lastSyncTime)
        userDefault.set(Int(Date().timeIntervalSince1970*1000), forKey: "lastSyncTime")
    }
}
