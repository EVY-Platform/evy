//
//  EVYListContainerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 29/6/2024.
//

import SwiftUI

struct EVYListContainerRow: View, EVYRowProtocol {
	public static let JSONType = "ListContainer"

	private let view: ListContainerRowViewData
	private let edit: SDUI_RowEdit?

	init(view: ListContainerRowViewData, edit: SDUI_RowEdit?) {
		self.view = view
		self.edit = edit
	}

	func complete() -> Bool {
		guard let minAmount = edit?.validation?.minAmountInt else { return true }
		let completeCount = view.content.children.filter { SDUI_Row.complete(row: $0) }.count
		return completeCount >= minAmount
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
					.padding(.vertical, Constants.padding)
			}
			ForEach(view.content.children, id: \.id) { child in
				EVYRow(row: child)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "2", "rows", "0", "view", "content", "children", "0"])
	}
}
