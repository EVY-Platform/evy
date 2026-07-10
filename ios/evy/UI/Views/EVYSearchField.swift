//
//  EVYSearchField.swift
//  evy
//
//  Created by Geoffroy Lesage on 9/4/2024.
//

import SwiftUI

struct EVYSearchField: View {
  @Binding var text: String
  let placeholder: String?

  var body: some View {
    EVYTextInput(
      text: $text,
      placeholder: placeholder.map { "::search:: \($0)" }
    )
    .autocorrectionDisabled()
    .textInputAutocapitalization(.never)
  }
}

#Preview {
  @Previewable @State var searchText = ""
  EVYSearchField(text: $searchText, placeholder: "Search items...")
}
