//
//  EVYSheetContainer.swift
//  evy
//
//  Created by Clemence Chalot on 7/3/2024.


import SwiftUI

struct EVYSheetContainerRow: View {
    public static var JSONType = "SheetContainer"

    private let view: SDUI.ContainerView

    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SDUI.ContainerView.self, forKey:.view)
    }
    
    @State private var showSheet = false
    
    var body: some View {
        self.view.content.child?
            .onTapGesture {
                showSheet.toggle()
            }
            .sheet(isPresented: $showSheet, content: {
                VStack {
                    EVYTextView(view.content.title, style: .title)
                    ForEach(view.content.children, id: \.id) { child in
                        child.padding(.horizontal)
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)
                .padding(.top, 30)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            })
    }
}


#Preview {
    let json = SDUIConstants.sheetContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
