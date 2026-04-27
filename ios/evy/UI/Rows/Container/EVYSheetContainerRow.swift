//
//  EVYSheetContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.
//

import SwiftUI

struct EVYSheetContainerRow: View, EVYRowProtocol {
  public static let JSONType = "SheetContainer"

  private let view: SheetContainerRowViewData
  @State private var showSheet: Bool = false

  init(view: SheetContainerRowViewData) {
    self.view = view
  }

  var body: some View {
    VStack(alignment: .leading) {
      if view.content.title.count > 0 {
        EVYTextView(view.content.title)
      }
      if let child = view.content.child {
        EVYRow(row: child)
          .contentShape(Rectangle())
          .onTapGesture { showSheet.toggle() }
          .sheet(isPresented: $showSheet) {
            VStack {
              ForEach(view.content.children, id: \.id) { row in
                EVYRow(row: row)
              }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.white.ignoresSafeArea())
            .padding(.top, Constants.majorPadding)
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground(.white)
          }
      }
    }
  }
}

#Preview {
  AsyncPreview { asyncView in
    EVYRow(row: asyncView)
  } view: {
    try! await EVY.getRow(["2", "pages", "0", "rows", "6"])
  }
}
