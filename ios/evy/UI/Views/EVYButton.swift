//
//  EVYButton.swift
//  evy
//
//  Created by Geoffroy Lesage on 18/12/2023.
//

import SwiftUI

struct EVYButton: View {
  @Environment(\.colorScheme) var colorScheme

  let label: String
  let style: String?
  let action: () -> Void

  init(label: String, style: String? = nil, action: @escaping () -> Void) {
    self.label = label
    self.style = style
    self.action = action
  }

  private var backgroundColor: Color {
    if style == "danger" {
      return Constants.dangerColor
    }
    return colorScheme == .light ? Constants.buttonColor : .white
  }

  var body: some View {
    Button(action: action) {
      EVYTextView(label, style: .button)
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
    }
    .buttonStyle(.plain)
    .padding(Constants.majorPadding)
    .background(backgroundColor)
    .cornerRadius(Constants.smallCornerRadius)
  }
}

#Preview {
  VStack {
    EVYButton(
      label: "button",
      action: {})
    EVYButton(
      label: "Cancel pickup request",
      style: "danger",
      action: {})
  }
}
