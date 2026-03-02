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

	func complete() -> Bool {
		guard let child = view.content.child else { return true }
		return SDUI_Row.complete(row: child)
	}

	func incompleteMessages() -> [String] {
		view.content.children
			.filter { !SDUI_Row.complete(row: $0) }
			.flatMap { SDUI_Row.incompleteMessages(row: $0) }
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
						.frame(maxHeight: .infinity, alignment: .top)
						.padding(.top, Constants.majorPadding)
						.presentationDetents([.medium, .large])
						.presentationDragIndicator(.visible)
					}
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "0", "rows", "6"])
	}
}
