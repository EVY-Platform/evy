//
//  hasDynamicIsland.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import UIKit

extension UIDevice {
    var hasDynamicIsland: Bool {
        guard userInterfaceIdiom == .phone else {
            return false
        }
               
        guard let window = (UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }.first { $0.isKeyWindow}) else {
            return false
        }
       
        return window.safeAreaInsets.top >= 50
    }
}
