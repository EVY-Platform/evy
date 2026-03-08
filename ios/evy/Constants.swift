//
//  Constants.swift
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
    static let base = 4.0
    
    static let padding = base
    static let fieldPadding: CGFloat = base*6
    static let majorPadding: CGFloat = base*4
    static let minorPadding: CGFloat = base*2
    
    static let mainCornerRadius: CGFloat = base*2
    static let smallCornerRadius: CGFloat = base

    static let textGreyColor = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
    static let buttonColor: Color = Color(#colorLiteral(red: 0.2352934182, green: 0.2352946103, blue: 0.2610042691, alpha: 1))
    static let buttonDisabledColor: Color = Color(#colorLiteral(red: 0.6000000238, green: 0.6000000238, blue: 0.6000000238, alpha: 1))
    static let tappableClearColor: Color = Color.black.opacity(0.0001)
    static let actionColor: Color = .blue
    static let inactiveBackground: Color = Color(#colorLiteral(red: 0.9621850848, green: 0.9621850848, blue: 0.9621850848, alpha: 1))
    
    static let borderWidth: CGFloat = 1.0
    static let thinBorderWidth: CGFloat = 0.5
    static let borderColor: Color = Color(#colorLiteral(red: 0.7267977595, green: 0.7267977595, blue: 0.7267977595, alpha: 1))
    static let borderOpacity: CGFloat = 0.5
	
	static let listRowHeight: CGFloat = base*12
}
