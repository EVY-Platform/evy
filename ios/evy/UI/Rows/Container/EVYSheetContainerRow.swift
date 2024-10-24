//
//  EVYSheetContainer.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.

// Tutorial https://www.youtube.com/watch?v=2ZL4z-UtP4o


import SwiftUI

struct EVYSheetContainerRow: View, EVYRowProtocol {
    public static let JSONType = "SheetContainer"

    private let view: SDUI.ContainerView
	@State private var showSheet = false

    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        self.view = try container.decode(SDUI.ContainerView.self, forKey:.view)
    }
	
	func complete() -> Bool {
		view.content.child!.complete()
	}
    
    var body: some View {
        self.view.content.child
            .contentShape(Rectangle())
            .onTapGesture { showSheet.toggle() }
            .sheet(isPresented: $showSheet, content: {
                VStack {
					if (view.content.children.first!.title.count > 0) {
						EVYTextView(view.content.children.first!.title)
					}
					ForEach(view.content.children, id: \.child.id) { child in
						child.child
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)
                .padding(.top, Constants.majorPadding)
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
