//
//  EVYRectangle.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

enum EVYRectangleStyle: String {
  case primary
  case secondary
  case clear
}

struct EVYRectangle<Content: View>: View {
  @Environment(\.colorScheme) var colorScheme

  let content: Content
  let style: EVYRectangleStyle
  let width: CGFloat?

  private let height: CGFloat = 40

  static func fixedWidth(
    content: Content,
    style: EVYRectangleStyle,
    width: CGFloat
  ) -> EVYRectangle<Content> {
    EVYRectangle(content: content, style: style, width: width)
  }

  static func fitWidth(
    content: Content,
    style: EVYRectangleStyle
  ) -> EVYRectangle<Content> {
    EVYRectangle(content: content, style: style, width: nil)
  }

  var body: some View {
    var textColor: Color
    var buttonFill: Color
    switch style {
    case .primary:
      textColor = (colorScheme == .light ? .white : .black)
      buttonFill = (colorScheme == .light ? Constants.buttonColor : .white)
    case .secondary:
      textColor = (colorScheme == .light ? .black : .white)
      buttonFill =
        (colorScheme == .light ? Constants.inactiveBackground : Constants.buttonDisabledColor)
    default:
      textColor = (colorScheme == .light ? .black : .white)
      buttonFill = .clear
    }

    return
      content
      .foregroundColor(textColor)
      .padding(Constants.minorPadding)
      .frame(width: width, height: height)
      .background(content: {
        RoundedRectangle(cornerRadius: Constants.mainCornerRadius)
          .fill(buttonFill)
      })
  }
}

#Preview {
  VStack {
    EVYRectangle.fixedWidth(content: EVYTextView("test"), style: .primary, width: 60)
    EVYRectangle.fixedWidth(content: EVYTextView("test"), style: .secondary, width: 60)
    EVYRectangle.fixedWidth(content: EVYTextView("test"), style: .clear, width: 60)
    EVYRectangle.fitWidth(content: EVYTextView("looooooooong"), style: .primary)
    EVYRectangle.fixedWidth(content: EVYTextView("toooo looong"), style: .primary, width: 70)
  }
}
