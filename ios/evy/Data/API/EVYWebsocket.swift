//
//  EVYWebsocket.swift
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

protocol EVYWebsocketProtocol {
	func connect(token: String, os: EVYOS) async throws -> Bool
	func fetch<T: Codable>(
		method: String,
		params: Encodable,
		expecting _: T.Type
	) async throws -> T
}

final class EVYWebsocket: EVYWebsocketProtocol {
    let rpc: Service<ServiceCore<WsConnectionFactory.Connection, WsConnectionFactory.Delegate>>
    
    init(host: String) {
        rpc = JsonRpc(.ws(url: URL(string: "ws://\(host)")!), queue: .main)
    }
    
    public func connect(token: String, os: EVYOS) async throws -> Bool {
		try await fetch(method: "rpc.login",
						params: EVYLoginParams(token: token, os: os),
						expecting: Bool.self)
    }
    
    public func fetch<T: Codable>(
        method: String,
        params: Encodable,
        expecting _: T.Type
    ) async throws -> T {
        try await rpc.call(method: method, params: params, T.self, String.self)
    }
}

final class EVYWebsocketMock: EVYWebsocketProtocol {
	public func connect(token: String, os: EVYOS) async throws -> Bool {
		return true
	}
	
	public func fetch<T: Codable>(
		method: String,
		params: Encodable,
		expecting _: T.Type
	) async throws -> T {
		switch method {
		case "getFlows":
			return try T.from(localJSON: "sdui")
		case "getData":
			let jsonObject = try EVYJson.from(localJSON: "data")
			let jsonData = try JSONEncoder().encode(jsonObject)
			return try JSONDecoder().decode(T.self, from: jsonData)
		default:
			return try T.from(localJSON: method)
		}
	}
}

enum JSONParseError: Error {
	case fileNotFound
	case dataInitialisation(error: Error)
	case decoding(error: Error)
}

extension Decodable {
	static func from(localJSON filename: String,
					 bundle: Bundle = .main) throws -> Self {
		guard let url = bundle.url(forResource: filename, withExtension: "json") else {
			throw JSONParseError.fileNotFound
		}
		let data: Data
		do {
			data = try Data(contentsOf: url)
		} catch let error {
			throw JSONParseError.dataInitialisation(error: error)
		}
		
		if self == Data.self {
			return data as! Self
		}

		do {
			return try JSONDecoder().decode(self, from: data)
		} catch let error {
			throw JSONParseError.decoding(error: error)
		}
	}
}
