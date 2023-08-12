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

let API_HOST = ProcessInfo.processInfo.environment["API_HOST"] ?? "localhost:8000"
let WS_RPC = JsonRpc(.ws(url: URL(string: "ws://\(API_HOST)")!), queue: .main)

final actor FWebsocket {
    static private var task: Task<FWebsocket, Error>?
    static public func shared(auth: FLoginParams) async throws -> FWebsocket {
        if let task {
            return try await task.value
        }
        let task = Task { try await FWebsocket(auth: auth) }
        self.task = task
        return try await task.value
    }
    private init(auth: FLoginParams) async throws {
        guard try await self.login(auth: auth) else {
            throw FWSError.loginError
        }
    }
    
    private func login(auth: FLoginParams) async throws -> Bool {
        try await self.callAPI(method: "rpc.login", params: Params(auth).first, expecting: Bool.self)
    }
    
    // Main messaging helper
    public func callAPI<T: Codable>(
        method: String,
        params: AnyEncodable?,
        expecting type: T.Type
    ) async throws -> T {
        try await WS_RPC.call(method: method, params: params, T.self, String.self)
    }
}
