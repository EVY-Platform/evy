//
//  EVYFunctionsPreviews.swift
//  evy
//

import SwiftUI

#Preview {
  EVYFunctionsPreview()
}

private struct EVYFunctionsPreview: View {
  init() {
    EVYPreviewMockData.seedCommon()
  }

  var body: some View {
    VStack {
      EVYTextView("{formatDimension(item.dimensions.width)}")
      EVYTextView("a == a: {a == a}")
      EVYTextView("a == b: {a == b}")
      EVYTextView("1 == 2: {1 == 2}")
    }
  }
}
