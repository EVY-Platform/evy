//
//  EVYRadioButton.swift
//  evy
//
//  Created by Clemence Chalot on 13/03/2024.
//

import SwiftUI

let radioSize: CGFloat = Constants.base*5

public enum EVYRadioStyle: String {
    case single
    case multi
}

struct EVYRadioButton: View {
    let isSelected: Bool
    let style: EVYRadioStyle
    var body: some View {
        buttonView
    }
}

private extension EVYRadioButton {
    @ViewBuilder var buttonView: some View {
        switch style {
        case .single:
            Circle()
                .fill(innerColor)
                .padding(Constants.padding)
                .overlay(
                    Circle().stroke(outlineColor, lineWidth: Constants.borderWidth)
                )
                .frame(width: radioSize, height: radioSize)
        case .multi:
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .fill(innerColor)
                .padding(Constants.padding)
                .overlay(
                    RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                        .stroke(outlineColor, lineWidth: Constants.borderWidth)
                )
                .frame(width: radioSize, height: radioSize)
        }
    }
}

private extension EVYRadioButton {
   var innerColor: Color {
       isSelected ? Constants.actionColor : Color.clear
   }

   var outlineColor: Color {
      isSelected ? Constants.actionColor : Constants.borderColor
   }
}

#Preview {
    VStack {
        EVYRadioButton(isSelected: true, style: .single)
        EVYRadioButton(isSelected: false, style: .single)
        EVYRadioButton(isSelected: true, style: .multi)
        EVYRadioButton(isSelected: false, style: .multi)
    }
}
