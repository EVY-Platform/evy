//
//  EVYWebsocket.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation
import JsonRPC

public enum EVYRPCError: LocalizedError {
    case loginError
    case connectionError(String)
    case rpcError(code: Int, message: String)
    case unknownError(String)
    
    public var errorDescription: String? {
        switch self {
        case .loginError:
            return "Authentication failed"
        case .connectionError(let message):
            return "Connection error: \(message)"
        case .rpcError(_, let message):
            return message
        case .unknownError(let message):
            return message
        }
    }
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
        do {
            return try await rpc.call(method: method, params: params, T.self, String.self)
        } catch let error as AsAnyRequestError {
            throw mapRequestError(error.anyRequestError)
        } catch {
            throw EVYRPCError.unknownError(error.localizedDescription)
        }
    }
    
    private func mapRequestError(_ error: RequestError<Any, Any>) -> EVYRPCError {
        switch error {
        case .reply(_, _, let responseError):
            return .rpcError(code: responseError.code, message: responseError.message)
        case .service(let serviceError):
            switch serviceError {
            case .connection(let cause):
                return .connectionError(cause.localizedDescription)
            case .codec(let cause):
                return .unknownError("Encoding/decoding error: \(cause.localizedDescription)")
            case .envelope(_, let description):
                return .unknownError("Protocol error: \(description)")
            case .unregisteredResponse(let id, _):
                return .unknownError("Unregistered response with id: \(id)")
            }
        case .empty:
            return .unknownError("Empty response from server")
        case .custom(let description, _):
            return .unknownError(description)
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
