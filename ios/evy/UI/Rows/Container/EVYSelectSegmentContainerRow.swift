//
//  EVYSelectSegmentContainerRow.swift
//  evy
//
//  Created by Clemence Chalot on 08/04/2024.
//

import SwiftUI

struct EVYSelectSegmentContainerRow: View, EVYRowProtocol {
	public static let JSONType = "SelectSegmentContainer"

	private let view: SelectSegmentContainerRowViewData
	private let edit: SDUI_RowEdit?
	@State private var selected: Int = 0

	init(view: SelectSegmentContainerRowViewData, edit: SDUI_RowEdit?) {
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
			}
			Picker("", selection: $selected) {
				ForEach(Array(view.content.segments.enumerated()), id: \.offset) { index, segment in
					Text(segment).tag(index)
				}
			}
			.pickerStyle(.segmented)
			.padding(.bottom, Constants.majorPadding)

			if selected < view.content.children.count {
				EVYRow(row: view.content.children[selected])
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "2", "rows", "0"])
	}
}
