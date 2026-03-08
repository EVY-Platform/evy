//
//  EVYColumnContainerRow.swift
//  EVY
//
//  Created by Geoffroy Lesage on 13/12/2023.
//

import SwiftUI

struct EVYColumnContainerRow: View, EVYRowProtocol {
	public static let JSONType = "ColumnContainer"

	private let view: ColumnContainerRowViewData
	private let edit: SDUI_RowEdit?

	init(view: ColumnContainerRowViewData, edit: SDUI_RowEdit?) {
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
			HStack(alignment: .top) {
				ForEach(Array(view.content.children.enumerated()), id: \.offset) { _, child in
					EVYRow(row: child)
				}
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "0", "rows", "5"])
	}
}
