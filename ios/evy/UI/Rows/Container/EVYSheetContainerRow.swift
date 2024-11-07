//
//  EVYSheetContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 07/03/2024.

// Tutorial https://www.youtube.com/watch?v=2ZL4z-UtP4o


import SwiftUI

struct EVYSheetContainerRow: View, EVYRowProtocol {
    public static let JSONType = "SheetContainer"

    private let view: SDUI.ContainerView
	@State private var showSheet: Bool = false

    init(container: KeyedDecodingContainer<RowCodingKeys>) throws {
        view = try container.decode(SDUI.ContainerView.self, forKey:.view)
    }
	
	init(from decoder: Decoder) throws {
		let container = try decoder.container(keyedBy: RowCodingKeys.self)
		try self.init(container: container)
	}
	
	func encode(to encoder: Encoder) throws {
		var container = encoder.container(keyedBy: RowCodingKeys.self)
		try container.encode(view, forKey: .view)
	}
	
	func complete() -> Bool {
		view.content.child!.complete()
	}
	
	func incompleteMessages() -> [String] {
		view.content.children
			.filter { $0.child.view.complete() == false }
			.map { $0.child.view.incompleteMessages() }
			.flatMap(\.self)
	}
    
    var body: some View {
        view.content.child
            .contentShape(Rectangle())
            .onTapGesture { showSheet.toggle() }
            .sheet(isPresented: $showSheet, content: {
                VStack {
					if view.content.children.first!.title.count > 0 {
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
	AsyncPreview { asyncView in
		asyncView
	} view: {
		try! await EVY.getRow(["1","pages","0","rows", "6"])
	}
}
