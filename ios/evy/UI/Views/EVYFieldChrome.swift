//
//  EVYFieldChrome.swift
//  evy
//

import SwiftUI

extension View {
  func evyFieldChrome() -> some View {
    padding(
      EdgeInsets(
        top: Constants.fieldPadding,
        leading: Constants.minorPadding,
        bottom: Constants.fieldPadding,
        trailing: Constants.minorPadding)
    )
    .background(
      RoundedRectangle(cornerRadius: Constants.smallCornerRadius)
        .strokeBorder(Constants.borderColor, lineWidth: Constants.borderWidth)
        .opacity(Constants.borderOpacity)
    )
    .contentShape(Rectangle())
  }
}
