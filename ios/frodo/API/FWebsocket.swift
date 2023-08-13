//
//  FWebsocket.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation
import JsonRPC

enum FWSError: Error {
    case loginError
}

struct FLoginParams: Encodable {
    let token: String
    let os: FOS
}

final class FWebsocket {
    var rpc: Service<ServiceCore<WsConnectionFactory.Connection, WsConnectionFactory.Delegate>>
    
    init(host: String) {
        rpc = JsonRpc(.ws(url: URL(string: "ws://\(host)")!), queue: .main)
    }
    
    public func connect(token: String, os: FOS) async throws {
        guard try await self.login(token: token, os: os) else {
            throw FWSError.loginError
        }
    }
    
    public func fetchServicesData(lastSyncTime: Double) async throws -> Array<FService> {
        try await callAPI(method: "fetchServicesData",
                          params: lastSyncTime,
                          expecting: Array<FService>.self)
    }
    
    private func login(token: String, os: FOS) async throws -> Bool {
        try await self.callAPI(method: "rpc.login",
                               params: FLoginParams(token: token, os: os),
                               expecting: Bool.self)
    }
    
    private func callAPI<T: Codable>(
        method: String,
        params: Encodable,
        expecting type: T.Type
    ) async throws -> T {
        try await rpc.call(method: method,
                           params: Params(params).first,
                           T.self,
                           String.self)
    }
}
