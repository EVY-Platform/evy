//
//  EVYTextInput.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYTextInput: View {
  @Binding var text: String
  let placeholder: String

  init(text: Binding<String>, placeholder: String) {
    self._text = text
    self.placeholder = placeholder
  }

  var body: some View {
    TextField(text: $text) {
      EVYTextView(placeholder, style: .info)
        .toText()
    }
    .font(.evy)
    .textFieldStyle(.plain)
    .padding(
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

#Preview {
  @Previewable @State var input = ""
  VStack(spacing: 16) {
    EVYTextInput(text: $input, placeholder: "Type something...")
    EVYTextInput(text: .constant("Filled value"), placeholder: "Placeholder")
  }
  .padding()
  .background(Color.gray.opacity(0.15))
}
