//
//  EVYSheetContainer.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.

// Tutorial https://www.youtube.com/watch?v=2ZL4z-UtP4o


import SwiftUI

struct EVYSheetContainerRow: View {
    public static let JSONType = "SheetContainer"

    private let view: SDUI.ContainerView

    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SDUI.ContainerView.self, forKey:.view)
    }
    
    @State private var showSheet = false
    
    var body: some View {
        self.view.content.child
            .contentShape(Rectangle())
            .onTapGesture { showSheet.toggle() }
            .sheet(isPresented: $showSheet, content: {
                VStack {
                    EVYTextView(view.content.title, style: .title)
                    ForEach(view.content.children, id: \.id) { child in
                        child
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
    let item = DataConstants.item.data(using: .utf8)!
    try! EVY.data.create(key: "item", data: item)
    
    let json = SDUIConstants.sheetContainerRow.data(using: .utf8)!
    return try! JSONDecoder().decode(EVYRow.self, from: json)
}
