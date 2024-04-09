//
//  EVYRadioButton.swift
//  evy
//
//  Created by Clemence Chalot on 13/3/2024.
//

import SwiftUI

struct EVYRadioButton: View {
    let isSelected: Bool
    var body: some View {
        circleView
    }
}

private extension EVYRadioButton {
  @ViewBuilder var circleView: some View {
     Circle()
       .fill(innerCircleColor) // Inner circle color
       .padding(4)
       .overlay(
          Circle()
            .stroke(outlineColor, lineWidth: 1)
        )
       .frame(width: 20, height: 20)
  }
}

private extension EVYRadioButton {
   var innerCircleColor: Color {
      guard isSelected else { return Color.clear }
      if !isSelected { return Color.gray.opacity(0.6) }
      return Color.blue
   }

   var outlineColor: Color {
      if !isSelected { return Color.gray.opacity(0.6) }
      return isSelected ? Color.blue : Color.gray
   }
}

#Preview {
    VStack {
        EVYRadioButton(isSelected: true)
        EVYRadioButton(isSelected: false)
    }
}
