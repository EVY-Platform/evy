//
//  EVYWebsocket.swift
//  EVY
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation
import JsonRPC
import Serializable

public enum EVYRPCError: LocalizedError {
    case loginError
    case connectionError(String)
    case rpcError(code: Int, message: String)
    case unknownError(String)
    case subscriptionError(String)
    
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
        case .subscriptionError(let message):
            return "Subscription error: \(message)"
        }
    }
}

struct EVYLoginParams: Encodable {
    let token: String
    let os: EVYOS
}

struct DataUpdatedNotification: Decodable {
    let dataId: String
    let data: EVYJson
    let createdAt: String
    let updatedAt: String
    
    enum CodingKeys: String, CodingKey {
        case dataId = "id"
        case data
        case createdAt
        case updatedAt
    }
}

struct FlowUpdatedNotification: Decodable {
    let flow: EVYFlow
    
    enum CodingKeys: String, CodingKey {
        case flow = "data"
    }
}

protocol EVYWebsocketProtocol {
	func connect(token: String, os: EVYOS) async throws -> Bool
	func fetch<T: Codable>(
		method: String,
		params: Encodable,
		expecting _: T.Type
	) async throws -> T
	func subscribe(event: String) async throws -> [String: String]
}

final class EVYWebsocket: EVYWebsocketProtocol {
    let rpc: Service<ServiceCore<WsConnectionFactory.Connection, WsConnectionFactory.Delegate>>
    
    init(host: String) {
        rpc = JsonRpc(.ws(url: URL(string: "ws://\(host)")!), queue: .main)
        rpc.delegate = self
    }
    
    public func connect(token: String, os: EVYOS) async throws -> Bool {
		try await fetch(method: "rpc.login",
						params: EVYLoginParams(token: token, os: os),
						expecting: Bool.self)
    }
    
    public func subscribe(event: String) async throws -> [String: String] {
        try await fetch(
            method: "rpc.on",
            params: [event],
            expecting: [String: String].self
        )
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

extension EVYWebsocket: ConnectableDelegate, NotificationDelegate, ErrorDelegate {
    
    public func state(_ state: ConnectableState) {
        print("[EVYWebsocket] Connection state changed: \(state)")
    }
    
    public func error(_ error: ServiceError) {
        print("[EVYWebsocket] Service error: \(error)")
    }
    
    public func notification(method: String, params: Parsable) {
        switch method {
        case "dataUpdated":
            handleDataUpdated(params: params)
        case "flowUpdated":
            handleFlowUpdated(params: params)
        default:
            print("[EVYWebsocket] Received unknown notification: \(method)")
        }
    }
    
    private func handleDataUpdated(params: Parsable) {
        // Parse synchronously on current thread
        guard let notification = try? params.parse(to: DataUpdatedNotification.self).get(),
              let encodedData = try? JSONEncoder().encode(notification.data) else {
            print("[EVYWebsocket] Failed to parse dataUpdated notification")
            return
        }
        
        // Dispatch to MainActor for thread-safe data access
        Task { @MainActor in
            do {
                if EVY.data.exists(key: notification.dataId) {
                    try EVY.data.update(props: [notification.dataId], data: encodedData)
                } else {
                    try EVY.data.create(key: notification.dataId, data: encodedData)
                }
                NotificationCenter.default.post(
                    name: Notification.Name.evyDataUpdated,
                    object: nil
                )
            } catch {
                print("[EVYWebsocket] Failed to update data: \(error)")
            }
        }
    }
    
    private func handleFlowUpdated(params: Parsable) {
        do {
            guard let notification = try params.parse(to: FlowUpdatedNotification.self).get() else {
                return
            }
            
            NotificationCenter.default.post(
                name: Notification.Name.evyFlowUpdated,
                object: notification.flow
            )
        } catch {
            print("[EVYWebsocket] Failed to parse flowUpdated notification: \(error)")
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
