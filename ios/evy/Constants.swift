//
//  AppConstants.swift
//  EVY
//
//  Created by Clemence Chalot on 11/12/2023.
//

import SwiftUI

extension Font {
    static let evy = Font.custom("SF Pro", size: 15)
    static let button = Font.custom("SF Pro", size: 24)
}

struct Constants {
    static let spacing = 4.0
    static let padding = 4.0
    
    static let majorPadding: CGFloat = 16
    static let minorPadding: CGFloat = 8
    static let minPading: CGFloat = 4
    
    static let borderWidth: CGFloat = 1.0
    
    static let mainCornerRadius: CGFloat = 10
    static let smallCornerRadius: CGFloat = 4

    static let buttonColor: Color = Color(#colorLiteral(red: 0.4745, green: 0.898, blue: 0.9569, alpha: 1))
    static let buttonDisabledColor: Color = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
    static let textButtonColor: Color = .blue
    static let inactiveBackground: Color = Color(#colorLiteral(red: 0.9621850848, green: 0.9621850848, blue: 0.9621850848, alpha: 1))
    static let fieldBorderColor: Color = Color(#colorLiteral(red: 0.2352934182, green: 0.2352946103, blue: 0.2610042691, alpha: 0.3))
    
    static let placeholderColor: Color = Color.gray
}
