//
//  EVYInlinePickerRow.swift
//  evy
//
//  Created by Geoffroy Lesage on 30/6/2024.
//

import SwiftUI

struct EVYInlinePickerRow: View, EVYRowProtocol {
	public static let JSONType = "InlinePicker"

	private let view: InlinePickerRowViewData
	private let edit: SDUI_RowEdit?

	init(view: InlinePickerRowViewData, edit: SDUI_RowEdit?) {
		self.view = view
		self.edit = edit
	}

	func complete() -> Bool {
		guard let validation = edit?.validation, validation.requiredBool else { return true }
		guard let destination = edit?.destination else { return false }
		do {
			let storedValue = try EVY.getDataFromText(destination)
			return storedValue.toString().count > 0
		} catch {
			return false
		}
	}

	func incompleteMessages() -> [String] {
		guard let msg = edit?.validation?.message else { return [] }
		return [msg]
	}

	var body: some View {
		VStack(alignment: .leading) {
			if view.content.title.count > 0 {
				EVYTextView(view.content.title)
					.padding(.vertical, Constants.padding)
			}
			if let destination = edit?.destination {
				EVYInlinePicker(
					title: view.content.title,
					data: view.data ?? "",
					format: view.content.format,
					destination: destination
				)
			}
		}
	}
}

#Preview {
	AsyncPreview { asyncView in
		EVYRow(row: asyncView)
	} view: {
		try! await EVY.getRow(["1", "pages", "2", "rows", "0", "view", "content", "children", "1", "view", "content", "children", "3"])
	}
}
