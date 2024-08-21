//
//  AppConstants.swift
//  EVY
//
//  Created by Clemence Chalot on 11/12/2023.
//

import SwiftUI

extension Font {
    static let evy = Font.custom("SFProText-Regular", size: 15)
    static let evyTitle = Font.custom("SFProText-Bold", size: 20)
    static let evyButton = Font.custom("SFProText-Regular", size: 24)
}

struct Constants {
    static let spacing = 4.0
    static let padding = 4.0
    
    static let fieldPadding: CGFloat = 24
    static let majorPadding: CGFloat = 16
    static let minorPadding: CGFloat = 8
    static let minPading: CGFloat = 4
    
    static let borderWidth: CGFloat = 1.0
    
    static let mainCornerRadius: CGFloat = 10
    static let smallCornerRadius: CGFloat = 4

    static let textColor = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
    static let buttonColor: Color = Color(#colorLiteral(red: 0.2352934182, green: 0.2352946103, blue: 0.2610042691, alpha: 1))
    static let buttonDisabledColor: Color = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
    static let tappableClearColor: Color = Color.black.opacity(0.0001)
    static let actionColor: Color = .blue
    static let inactiveBackground: Color = Color(#colorLiteral(red: 0.9621850848, green: 0.9621850848, blue: 0.9621850848, alpha: 1))
    static let fieldBorderColor: Color = Color(#colorLiteral(red: 0.725489974, green: 0.7254903913, blue: 0.7340979576, alpha: 1))
    static let fieldBorderOpacity: CGFloat = 0.5
}
