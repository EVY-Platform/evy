//
//  AppConstants.swift
//  frodo
//
//  Created by Clemence Chalot on 11/12/2023.
//

import SwiftUI


extension Font {
    static let titleFont = Font.system(size: 20, weight: .bold)
    static let detailFont = Font.system(size: 16, weight: .bold)
    static let regularFont = Font.system(size: 16)
    static let buttonFont = Font.system(size: 24)
}

struct Constants {
    static let textLinePadding: CGFloat = 4
    static let textLinePaddingMin: CGFloat = 1
    static let textHeadingLinePadding: CGFloat = 16
    static let buttonCornerPadding: CGFloat = 16
    
    static let buttonColor: Color = Color(#colorLiteral(red: 0.4745, green: 0.898, blue: 0.9569, alpha: 1))
    static let buttonDisabledColor: Color = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
}
