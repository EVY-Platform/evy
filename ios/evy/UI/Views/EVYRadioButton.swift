//
//  EVYRadioButton.swift
//  evy
//
//  Created by Clemence Chalot on 13/03/2024.
//

import SwiftUI

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
                .padding(4)
                .overlay(
                    Circle()
                        .stroke(outlineColor, lineWidth: 1)
                )
                .frame(width: 20, height: 20)
        case .multi:
            RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                .fill(innerColor)
                .padding(4)
                .overlay(
                    RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
                        .stroke(outlineColor, lineWidth: 1)
                )
                .frame(width: 20, height: 20)
        }
    }
}

private extension EVYRadioButton {
   var innerColor: Color {
      guard isSelected else { return Color.clear }
      if !isSelected { return Constants.fieldBorderColor.opacity(0.6) }
      return Constants.actionColor
   }

   var outlineColor: Color {
      if !isSelected { return Constants.fieldBorderColor.opacity(0.6) }
      return isSelected ? Constants.actionColor : Constants.fieldBorderColor
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
