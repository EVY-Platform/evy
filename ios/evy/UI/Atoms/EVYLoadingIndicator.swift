//
//  EVYLoadingIndicator.swift
//  evy
//

import SwiftUI

struct EVYLoadingIndicator: View {
  var tint: Color = .primary

  @State private var pulsing = false

  var body: some View {
    Image(systemName: "icloud.and.arrow.up.fill")
      .font(.body)
      .foregroundStyle(tint)
      .opacity(pulsing ? 0.2 : 1.0)
      .animation(.easeInOut(duration: 0.25).repeatForever(autoreverses: true), value: pulsing)
      .onAppear { pulsing = true }
  }
}
