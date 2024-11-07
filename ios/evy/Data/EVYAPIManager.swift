//
//  EVYAPIManager.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation

enum EVYAPIManagerError: Error {
    case loginError
	case invalidMethod
}

let DEFAULT_HOST = "localhost"
let DEFAULT_PORT = 8000

let API_HOST = ProcessInfo.processInfo.environment["API_HOST"] ?? "\(DEFAULT_HOST):\(DEFAULT_PORT)"
let userDefault = UserDefaults.standard

final class EVYAPIManager {
	private let rpcWS: EVYWebsocketProtocol
    static let shared = EVYAPIManager()
	private var authed: Bool = false
	
	public func fetch<T: Codable>(
		method: String,
		params: Encodable,
		expecting _: T.Type
	) async throws -> T {
		try await validateAuth()
		return try await rpcWS.fetch(method: method, params: params, expecting: T.self)
	}
    
    private init() {
		if ProcessInfo.processInfo.environment["DEBUG"] == "true" {
			self.rpcWS = EVYWebsocketMock()
		} else {
			self.rpcWS = EVYWebsocket(host: API_HOST)
		}
	}
	
	private func validateAuth() async throws {
		if (!authed) { authed = try await rpcWS.connect(token: "Geo", os: EVYOS.ios) }
	}
}
