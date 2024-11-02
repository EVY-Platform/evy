//
//  FWebsocket.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation
import JsonRPC

enum EVYWSError: Error {
    case loginError
}

struct EVYLoginParams: Encodable {
    let token: String
    let os: EVYOS
}

final class EVYWebsocket {
    let rpc: Service<ServiceCore<WsConnectionFactory.Connection, WsConnectionFactory.Delegate>>
    
    init(host: String) {
        rpc = JsonRpc(.ws(url: URL(string: "ws://\(host)")!), queue: .main)
    }
    
    public func connect(token: String, os: EVYOS) async throws {
        guard try await login(token: token, os: os) else {
            throw EVYWSError.loginError
        }
    }
    
    public func fetchServicesData(lastSyncTime: Int) async throws -> [String: [EVYService]] {
        try await callAPI(method: "getNewDataSince",
                          params: ["since": lastSyncTime],
                          expecting: [String: [EVYService]].self)
    }
    
    private func login(token: String, os: EVYOS) async throws -> Bool {
        try await callAPI(method: "rpc.login",
                               params: EVYLoginParams(token: token, os: os),
                               expecting: Bool.self)
    }
    
    private func callAPI<T: Codable>(
        method: String,
        params: Encodable,
        expecting _: T.Type
    ) async throws -> T {
        try await rpc.call(method: method,
                           params: "", //Params(params).first,
                           T.self,
                           String.self)
    }
}
