//
//  EVYApp.swift
//  EVY
//
//  Created by Geoffroy Lesage on 11/12/2023.
//

import SwiftUI

@main
struct evyApp: App {
    init() {
        let item = DataConstants.item.data(using: .utf8)!
        let _ = try! EVYDataFactory.create(item)
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
