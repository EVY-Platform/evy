//
//  FWebsocket.swift
//  frodo
//
//  Created by Geoffroy Lesage on 26/7/2023.
//

import Foundation
import JsonRPC

let API_HOST = ProcessInfo.processInfo.environment["API_HOST"]

final class FWebsocket {
    static let shared = FWebsocket()
    
    private let rpc = JsonRpc(.ws(url: URL(string: "ws://\(API_HOST ?? "localhost:8000")")!), queue: .main)
    
    private init() {}
    
    public func login() {
        let loginParams = Params(FLoginParams(
            token: "geo",
            os: FOS.ios
        )).first
            
        self.rpc.call(method: "rpc.login", params: loginParams, Bool.self, String.self) { res in
            if (try! res.get() != true) {
                print("Could not login")
            }
            else {
                print("Logged in")
            }
        }
    }
}
